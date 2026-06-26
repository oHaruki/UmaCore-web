import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { botApiFetch } from '@/lib/bot-api'

type GuildRole = { id: string; name: string; color: number; position: number; managed: boolean }

async function fetchGuildRoles(guildId: string): Promise<GuildRole[] | null> {
  try {
    const res = await botApiFetch(`/guild_roles?guild_id=${guildId}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data.roles) ? (data.roles as GuildRole[]) : null
  } catch {
    return null
  }
}

// Assigning manager roles is Discord-admin-only (no self-escalation by managers).
function isDiscordAdmin(session: { adminGuildIds?: string[] } | null, guildId: string): boolean {
  return !!session?.adminGuildIds?.includes(guildId)
}

// GET — current manager roles for the guild + the guild's assignable roles
export async function GET(_req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { guildId } = await params
  if (!isDiscordAdmin(session, guildId))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const bound = await query<{ role_id: string }>(
    'SELECT role_id::text AS role_id FROM guild_manager_roles WHERE guild_id = $1',
    [guildId]
  )
  const roles = await fetchGuildRoles(guildId)

  return NextResponse.json({
    bot_reachable: roles !== null,
    managers: bound.map(b => b.role_id),
    roles: roles ?? [],
  })
}

// POST — add a manager role  { role_id, role_name? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { guildId } = await params
  if (!isDiscordAdmin(session, guildId))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role_id, role_name } = await req.json().catch(() => ({}))
  if (!role_id || !/^\d+$/.test(String(role_id)))
    return NextResponse.json({ error: 'Valid role_id required' }, { status: 400 })

  await query(
    `INSERT INTO guild_manager_roles (guild_id, role_id)
     VALUES ($1, $2) ON CONFLICT (guild_id, role_id) DO NOTHING`,
    [guildId, role_id]
  )

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'
  await logAudit({ actorId, actorName, action: 'guild.manager.add', entityType: 'guild', entityId: guildId, details: { guild_id: guildId, role_id: String(role_id), role_name: role_name ?? null } })

  return NextResponse.json({ ok: true })
}

// DELETE — remove a manager role  { role_id, role_name? }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { guildId } = await params
  if (!isDiscordAdmin(session, guildId))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role_id, role_name } = await req.json().catch(() => ({}))
  if (!role_id) return NextResponse.json({ error: 'role_id required' }, { status: 400 })

  await query('DELETE FROM guild_manager_roles WHERE guild_id = $1 AND role_id = $2', [guildId, role_id])

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'
  await logAudit({ actorId, actorName, action: 'guild.manager.remove', entityType: 'guild', entityId: guildId, details: { guild_id: guildId, role_id: String(role_id), role_name: role_name ?? null } })

  return NextResponse.json({ ok: true })
}
