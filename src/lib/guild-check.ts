import type { Session } from 'next-auth'
import { query } from './db'

export async function ownsClub(session: Session, clubId: string): Promise<boolean> {
  const guildIds = session.adminGuildIds
  if (!guildIds?.length) return false
  const rows = await query(
    'SELECT 1 FROM clubs WHERE club_id = $1 AND guild_id::text = ANY($2::text[])',
    [clubId, guildIds]
  )
  return rows.length > 0
}
