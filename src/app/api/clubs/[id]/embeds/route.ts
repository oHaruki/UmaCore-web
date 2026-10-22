import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'
import { botApiFetch } from '@/lib/bot-api'

const MODES = ['streak', 'quota']

// The bot owns the fields, tokens and renderer, so the editor's vocabulary and
// its preview both come from it rather than a copy here that would drift.
async function botJson<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T } | null> {
  try {
    const res = await botApiFetch(path, { signal: AbortSignal.timeout(15000), ...init })
    return { status: res.status, data: (await res.json()) as T }
  } catch {
    return null
  }
}

const offline = () =>
  NextResponse.json({ error: 'UmaCore is offline, so the editor can’t load or check styles right now.' }, { status: 503 })

// GET — the editor's fields, presets and the club's current styles
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await ownsClub(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const res = await botJson<Record<string, unknown>>(`/embed_style?club_id=${encodeURIComponent(id)}`)
  if (!res) return offline()
  if (res.status !== 200) return NextResponse.json(res.data, { status: res.status })

  // For the role-ping picker, and so mentions in the preview show role names.
  const guild = await query<{ guild_id: string | null }>(
    'SELECT guild_id::text AS guild_id FROM clubs WHERE club_id = $1', [id]
  )
  const guildId = guild[0]?.guild_id
  const roles = guildId
    ? await botJson<{ roles?: { id: string; name: string; color: number; managed: boolean }[] }>(
        `/guild_roles?guild_id=${guildId}`
      )
    : null

  return NextResponse.json({
    ...res.data,
    roles: (roles?.status === 200 ? roles.data.roles ?? [] : [])
      .filter(r => !r.managed)
      .map(r => ({ id: r.id, name: r.name, color: r.color })),
  })
}

// POST — preview one kind with an unsaved style  { kind, style, days_behind_mode?, closed? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await ownsClub(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const res = await botJson<Record<string, unknown>>('/embed_style/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      club_id: id,
      kind: body.kind,
      style: body.style,
      days_behind_mode: body.days_behind_mode,
      closed: !!body.closed,
    }),
  })
  if (!res) return offline()
  return NextResponse.json(res.data, { status: res.status })
}

// PUT — save  { style: { report, live }, days_behind_mode }
//
// The bot checks every field and hands back only what differs from the
// defaults. The old daily-gain switch goes off in the same write: the editor
// shows its lines as the club's own, so they're stored with the rest.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await ownsClub(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const mode = body.days_behind_mode
  if (!MODES.includes(mode))
    return NextResponse.json({ error: 'days_behind_mode must be streak or quota' }, { status: 400 })

  const res = await botJson<{ embed_style: Record<string, unknown>; errors: Record<string, Record<string, string>> }>(
    '/embed_style/validate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ club_id: id, style: body.style }),
    }
  )
  if (!res) return offline()
  if (res.status !== 200) return NextResponse.json(res.data, { status: res.status })
  if (Object.keys(res.data.errors ?? {}).length)
    return NextResponse.json({ error: 'Some fields need fixing', errors: res.data.errors }, { status: 400 })

  await query(
    `UPDATE clubs SET embed_style = $2::jsonb, days_behind_mode = $3, report_daily_gain = FALSE,
                      updated_at = NOW()
     WHERE club_id = $1`,
    [id, JSON.stringify(res.data.embed_style), mode]
  )

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'
  await logAudit({
    actorId, actorName, action: 'club.update', entityType: 'club', entityId: id, clubId: id,
    details: { changes: { embed_style: res.data.embed_style, days_behind_mode: mode } },
  })

  return NextResponse.json({ ok: true, embed_style: res.data.embed_style })
}
