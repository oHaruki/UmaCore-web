import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'
import { botApiFetch } from '@/lib/bot-api'

type GuildChannel = {
  id: string
  name: string
  type: string
  position: number
  category: string | null
  can_rename: boolean
  can_post: boolean
}

type ChannelOutcome = {
  status: string
  name?: string
  code?: number
  detail?: string
  access?: string
  timeout?: string | null
}

type RefreshResult = {
  updated: number
  failed: number
  forbidden: number
  source: string | null
  per_channel?: Record<string, ChannelOutcome>
}

type Binding = {
  channel_id: string
  template: string
  enabled: boolean
  last_rendered: string | null
  last_updated: string | null
}

// The bot owns the renderer, so the token list and the preview come from it
// rather than being reimplemented here, where the two would silently drift.
async function botJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await botApiFetch(path, { signal: AbortSignal.timeout(15000), ...init })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function clubGuildId(clubId: string): Promise<string | null> {
  const rows = await query<{ guild_id: string | null }>(
    'SELECT guild_id::text AS guild_id FROM clubs WHERE club_id = $1',
    [clubId]
  )
  return rows[0]?.guild_id ?? null
}

async function bindings(clubId: string): Promise<Binding[]> {
  return query<Binding>(
    `SELECT channel_id::text AS channel_id, template, enabled, last_rendered,
            last_updated
     FROM club_channel_names
     WHERE club_id = $1
     ORDER BY created_at`,
    [clubId]
  )
}

function actor(session: Session) {
  return {
    actorId: (session.user as { id?: string })?.id ?? 'unknown',
    actorName: (session.user as { name?: string })?.name ?? 'unknown',
  }
}

// GET — this club's bindings, the guild's channels, and the token vocabulary.
// With ?template=, returns just that template's preview, for typing feedback.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await ownsClub(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const template = req.nextUrl.searchParams.get('template')
  if (template !== null) {
    const check = await botJson<{ preview: string; unknown_tokens: string[] }>(
      `/channel_names/preview?template=${encodeURIComponent(template)}`
    )
    return NextResponse.json(check ?? { preview: null, unknown_tokens: [] })
  }

  const guildId = await clubGuildId(id)

  const [rows, channels, help] = await Promise.all([
    bindings(id),
    guildId
      ? botJson<{ channels: GuildChannel[] }>(`/guild_channels?guild_id=${guildId}`)
      : Promise.resolve(null),
    botJson<{ tokens: Record<string, string>; max_length: number }>(
      '/channel_names/preview'
    ),
  ])

  return NextResponse.json({
    guild_id: guildId,
    // Distinguishes "the bot is offline" from "this server has no channels",
    // which need different things said to the user.
    bot_reachable: channels !== null,
    bindings: rows,
    channels: channels?.channels ?? [],
    tokens: help?.tokens ?? {},
    max_length: help?.max_length ?? 100,
  })
}

// POST — bind a channel to a template  { channel_id, template }
//
// Saves, then asks the bot to rename immediately: the scheduled paths run hourly
// at best, and nobody should have to wait that long to see whether the template
// they just typed reads the way they meant.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await ownsClub(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { channel_id, template, refresh_only } = await req.json().catch(() => ({}))

  // The "update now" button: no binding to save, just rewrite the names.
  if (refresh_only) {
    const now = await botJson<RefreshResult>('/channel_names/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ club_id: id }),
    })
    if (!now)
      return NextResponse.json({ error: 'Bot unreachable' }, { status: 503 })
    return NextResponse.json({ ok: true, refreshed: now, bindings: await bindings(id) })
  }

  if (!channel_id || !/^\d+$/.test(String(channel_id)))
    return NextResponse.json({ error: 'Valid channel_id required' }, { status: 400 })

  const text = String(template ?? '').trim()
  if (!text)
    return NextResponse.json({ error: 'Template cannot be empty' }, { status: 400 })

  const check = await botJson<{ unknown_tokens: string[]; preview: string; max_length: number }>(
    `/channel_names/preview?template=${encodeURIComponent(text)}`
  )
  if (check?.unknown_tokens?.length)
    return NextResponse.json(
      { error: `Unknown token(s): ${check.unknown_tokens.map(t => `{${t}}`).join(', ')}` },
      { status: 400 }
    )
  if (text.length > (check?.max_length ?? 100))
    return NextResponse.json(
      { error: `Template is longer than Discord allows (${check?.max_length ?? 100} characters)` },
      { status: 400 }
    )

  // channel_id is unique across clubs, so re-pointing a channel moves it rather
  // than leaving two clubs fighting over the same name.
  await query(
    `INSERT INTO club_channel_names (club_id, channel_id, template, enabled)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (channel_id) DO UPDATE
       SET club_id = $1, template = $3, enabled = TRUE, last_rendered = NULL`,
    [id, channel_id, text]
  )

  await logAudit({
    ...actor(session),
    action: 'club.update',
    entityType: 'club',
    entityId: id,
    clubId: id,
    details: { changes: { channel_name: text, channel_id: String(channel_id) } },
  })

  // Scoped to this channel: a club-wide refresh would let another channel's
  // rename be reported as this one's, and would spend its rename budget too.
  const refresh = await botJson<RefreshResult>('/channel_names/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ club_id: id, channel_id: String(channel_id) }),
  })

  return NextResponse.json({
    ok: true,
    preview: check?.preview ?? null,
    // null means the bot could not be reached — the binding is still saved and
    // the next scheduled update will pick it up.
    refreshed: refresh,
    // What happened to *this* channel, rather than to the club as a whole.
    outcome: refresh?.per_channel?.[String(channel_id)] ?? null,
    bindings: await bindings(id),
  })
}

// PATCH — pause or resume a binding  { channel_id, enabled }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await ownsClub(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { channel_id, enabled } = await req.json().catch(() => ({}))
  if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
  if (typeof enabled !== 'boolean')
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })

  await query(
    'UPDATE club_channel_names SET enabled = $3 WHERE club_id = $1 AND channel_id = $2',
    [id, channel_id, enabled]
  )

  await logAudit({
    ...actor(session),
    action: 'club.update',
    entityType: 'club',
    entityId: id,
    clubId: id,
    details: { changes: { channel_name_enabled: enabled, channel_id: String(channel_id) } },
  })

  return NextResponse.json({ ok: true, bindings: await bindings(id) })
}

// DELETE — stop tracking a channel  { channel_id }
//
// The channel keeps whatever name it currently has: silently renaming it back to
// something we never recorded would be a worse surprise than leaving it.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await ownsClub(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { channel_id } = await req.json().catch(() => ({}))
  if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })

  await query(
    'DELETE FROM club_channel_names WHERE club_id = $1 AND channel_id = $2',
    [id, channel_id]
  )

  await logAudit({
    ...actor(session),
    action: 'club.update',
    entityType: 'club',
    entityId: id,
    clubId: id,
    details: { changes: { channel_name: null, channel_id: String(channel_id) } },
  })

  return NextResponse.json({ ok: true, bindings: await bindings(id) })
}
