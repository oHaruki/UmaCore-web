import type { Session } from 'next-auth'
import { query } from './db'

/** All Discord role IDs the user holds across the guilds we resolved roles for. */
function allUserRoleIds(session: Session): string[] {
  const map = session.guildRoles ?? {}
  return Object.values(map).flat()
}

/** Guild IDs where the user holds a manager role (full powers over all that guild's clubs). */
export async function managerGuildIds(session: Session): Promise<string[]> {
  const roleIds = allUserRoleIds(session)
  if (!roleIds.length) return []
  const rows = await query<{ guild_id: string }>(
    `SELECT DISTINCT guild_id::text AS guild_id
     FROM guild_manager_roles
     WHERE role_id::text = ANY($1::text[])`,
    [roleIds]
  )
  return rows.map(r => r.guild_id)
}

/** Guilds the user effectively administers: Discord admin guilds ∪ manager-role guilds. */
export async function effectiveAdminGuildIds(session: Session): Promise<string[]> {
  const admin = session.adminGuildIds ?? []
  const managed = await managerGuildIds(session)
  return Array.from(new Set([...admin, ...managed]))
}

/**
 * Full-admin check for a club: the user is a Discord administrator OR holds a
 * manager role in the club's guild. Used for actions above a per-club editor —
 * assigning club-editor roles, deleting, etc.
 */
export async function isClubAdmin(session: Session, clubId: string): Promise<boolean> {
  const guildIds = await effectiveAdminGuildIds(session)
  if (!guildIds.length) return false
  const rows = await query(
    'SELECT 1 FROM clubs WHERE club_id = $1 AND guild_id::text = ANY($2::text[])',
    [clubId, guildIds]
  )
  return rows.length > 0
}

/** True if the user holds a role that an admin bound to this specific club. */
export async function hasEditorRoleForClub(session: Session, clubId: string): Promise<boolean> {
  const roleIds = allUserRoleIds(session)
  if (!roleIds.length) return false
  const rows = await query(
    `SELECT 1 FROM club_role_permissions
     WHERE club_id = $1 AND role_id::text = ANY($2::text[]) LIMIT 1`,
    [clubId, roleIds]
  )
  return rows.length > 0
}

/**
 * Can the user manage this club?
 *  - Administrator of the club's guild, OR
 *  - holds an editor role bound to THIS club (and only this club).
 * Note: club deletion is never granted here — that stays admin-only and is not
 * exposed via the web at all.
 */
export async function ownsClub(session: Session, clubId: string): Promise<boolean> {
  const guildIds = await effectiveAdminGuildIds(session)
  if (guildIds.length) {
    const rows = await query(
      'SELECT 1 FROM clubs WHERE club_id = $1 AND guild_id::text = ANY($2::text[])',
      [clubId, guildIds]
    )
    if (rows.length > 0) return true
  }
  return hasEditorRoleForClub(session, clubId)
}

/** Club IDs the user can manage via editor roles (excludes guild-admin clubs). */
export async function editorClubIds(session: Session): Promise<string[]> {
  const roleIds = allUserRoleIds(session)
  if (!roleIds.length) return []
  const rows = await query<{ club_id: string }>(
    `SELECT DISTINCT club_id::text AS club_id
     FROM club_role_permissions
     WHERE role_id::text = ANY($1::text[])`,
    [roleIds]
  )
  return rows.map(r => r.club_id)
}

/**
 * Every club the user can see: clubs in guilds they administer, plus clubs an
 * editor role grants them. Returned as a flat list of club_ids — pages filter
 * with `WHERE club_id = ANY(...)` instead of by guild, so editor clubs show up.
 */
export async function accessibleClubIds(session: Session): Promise<string[]> {
  const guildIds = await effectiveAdminGuildIds(session)
  const editors = await editorClubIds(session)
  let adminClubs: string[] = []
  if (guildIds.length) {
    const rows = await query<{ club_id: string }>(
      'SELECT club_id::text AS club_id FROM clubs WHERE guild_id::text = ANY($1::text[])',
      [guildIds]
    )
    adminClubs = rows.map(r => r.club_id)
  }
  return Array.from(new Set([...adminClubs, ...editors]))
}

/** Editor roles the user holds in a guild that are bound to at least one club there. */
export async function editorRolesInGuild(session: Session, guildId: string): Promise<string[]> {
  const roleIds = session.guildRoles?.[guildId] ?? []
  if (!roleIds.length) return []
  const rows = await query<{ role_id: string }>(
    `SELECT DISTINCT crp.role_id::text AS role_id
     FROM club_role_permissions crp
     JOIN clubs c ON c.club_id = crp.club_id
     WHERE c.guild_id::text = $1 AND crp.role_id::text = ANY($2::text[])`,
    [guildId, roleIds]
  )
  return rows.map(r => r.role_id)
}
