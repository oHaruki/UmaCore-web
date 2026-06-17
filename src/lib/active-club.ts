import { cookies } from 'next/headers'
import type { Session } from 'next-auth'
import { query } from './db'
import { accessibleClubIds } from './guild-check'

export const ACTIVE_CLUB_COOKIE = 'active_club'

export type AccessibleClub = { club_id: string; club_name: string; is_active: boolean; guild_id: string | null }

/** All clubs the user can access, with names — for the switcher and landing grid. */
export async function getAccessibleClubs(session: Session): Promise<AccessibleClub[]> {
  const ids = await accessibleClubIds(session)
  if (!ids.length) return []
  return query<AccessibleClub>(
    `SELECT club_id::text AS club_id, club_name, is_active, guild_id::text AS guild_id
     FROM clubs WHERE club_id::text = ANY($1::text[]) ORDER BY club_name`,
    [ids]
  )
}

export async function getActiveClubId(): Promise<string | null> {
  const c = await cookies()
  return c.get(ACTIVE_CLUB_COOKIE)?.value ?? null
}

/**
 * Resolve the active club: the cookie value if it's still accessible, otherwise
 * the first accessible club. Returns the full accessible list too so callers can
 * render the switcher without a second query.
 */
export async function resolveActiveClub(
  session: Session
): Promise<{ active: AccessibleClub | null; clubs: AccessibleClub[] }> {
  const clubs = await getAccessibleClubs(session)
  if (!clubs.length) return { active: null, clubs }
  const cookieId = await getActiveClubId()
  const active = clubs.find(c => c.club_id === cookieId) ?? clubs[0]
  return { active, clubs }
}
