import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { isClubAdmin } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'

const BOT_API = process.env.BOT_API_URL ?? 'http://127.0.0.1:7890'

type GuildRole = { id: string; name: string; color: number; position: number; managed: boolean }

// Returns the role list, or null if the bot couldn't be reached / the guild
// isn't available (so the UI can tell "no roles" apart from "bot offline").
async function fetchGuildRoles(guildId: string): Promise<GuildRole[] | null> {
  try {
    const res = await fetch(`${BOT_API}/guild_roles?guild_id=${guildId}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data.roles) ? (data.roles as GuildRole[]) : null
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

// GET — current editor role bindings for the club + the guild's assignable roles
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await isClubAdmin(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const guildId = await clubGuildId(id)
  const bound = await query<{ role_id: string }>(
    'SELECT role_id::text AS role_id FROM club_role_permissions WHERE club_id = $1',
    [id]
  )
  const boundIds = bound.map(b => b.role_id)
  const roles = guildId ? await fetchGuildRoles(guildId) : null

  return NextResponse.json({
    guild_id: guildId,
    bot_reachable: roles !== null,
    editors: boundIds,
    roles: roles ?? [],
  })
}

// POST — bind a role to the club  { role_id }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await isClubAdmin(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role_id, role_name } = await req.json().catch(() => ({}))
  if (!role_id || !/^\d+$/.test(String(role_id)))
    return NextResponse.json({ error: 'Valid role_id required' }, { status: 400 })

  await query(
    `INSERT INTO club_role_permissions (club_id, role_id)
     VALUES ($1, $2) ON CONFLICT (club_id, role_id) DO NOTHING`,
    [id, role_id]
  )

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'
  await logAudit({ actorId, actorName, action: 'club.editor.add', entityType: 'club', entityId: id, clubId: id, details: { role_id: String(role_id), role_name: role_name ?? null } })

  return NextResponse.json({ ok: true })
}

// DELETE — remove a role binding  { role_id }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await isClubAdmin(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role_id, role_name } = await req.json().catch(() => ({}))
  if (!role_id) return NextResponse.json({ error: 'role_id required' }, { status: 400 })

  await query('DELETE FROM club_role_permissions WHERE club_id = $1 AND role_id = $2', [id, role_id])

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'
  await logAudit({ actorId, actorName, action: 'club.editor.remove', entityType: 'club', entityId: id, clubId: id, details: { role_id: String(role_id), role_name: role_name ?? null } })

  return NextResponse.json({ ok: true })
}
