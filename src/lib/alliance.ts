import { randomInt } from 'crypto'
import type { Session } from 'next-auth'
import { query, queryOne } from './db'
import { ownsClub } from './guild-check'

// Sister clubs on one leaderboard. The bot owns the tables (alliances,
// alliance_clubs) and the /alliance command; this file mirrors its standings
// query in UmaCore/services/alliance.py, so keep the two in step.

export const MAX_CLUBS = 10
export const NAME_MAX = 40

export type Alliance = {
  alliance_id: string
  name: string
  slug: string
  owner_club_id: string | null
  invite_code: string
  is_public: boolean
}

export type AllianceClub = {
  club_id: string
  club_name: string
  guild_id: string | null
  joined_at: string
  club_rank: number | null
  public_slug: string | null
}

export type TrainerRow = {
  member_id: string
  trainer_name: string
  club_id: string
  club_name: string
  fans: number
  day_gain: number | null
}

export type ClubStanding = AllianceClub & { members: number; fans: number; day_gain: number; avg: number }

export type Standings = {
  month: string | null
  latestDate: string | null
  clubs: ClubStanding[]
  trainers: TrainerRow[]
}

const ALLIANCE_COLS = `a.alliance_id::text, a.name, a.slug, a.owner_club_id::text, a.invite_code, a.is_public`

export function getAllianceForClub(clubId: string) {
  return queryOne<Alliance>(
    `SELECT ${ALLIANCE_COLS} FROM alliance_clubs ac
     JOIN alliances a ON a.alliance_id = ac.alliance_id
     WHERE ac.club_id = $1::uuid`,
    [clubId]
  )
}

export function getAlliance(id: string) {
  return queryOne<Alliance>(`SELECT ${ALLIANCE_COLS} FROM alliances a WHERE a.alliance_id = $1::uuid`, [id])
}

export function getAllianceBySlug(slug: string) {
  return queryOne<Alliance>(`SELECT ${ALLIANCE_COLS} FROM alliances a WHERE a.slug = $1`, [slug])
}

export function getAllianceClubs(allianceId: string) {
  return query<AllianceClub>(
    `SELECT c.club_id::text, c.club_name, c.guild_id::text, ac.joined_at::text,
            (SELECT club_rank FROM club_rank_history r
              WHERE r.club_id = c.club_id ORDER BY r.date DESC LIMIT 1) AS club_rank,
            CASE WHEN c.public_enabled THEN c.public_slug END AS public_slug
     FROM alliance_clubs ac
     JOIN clubs c ON c.club_id = ac.club_id
     WHERE ac.alliance_id = $1::uuid AND c.is_active
     ORDER BY ac.joined_at`,
    [allianceId]
  )
}

/**
 * The club that runs the alliance. Normally the creator; if that club was
 * deleted, the longest-standing member club takes over.
 */
export async function effectiveOwnerId(a: Alliance): Promise<string | null> {
  if (a.owner_club_id) return a.owner_club_id
  const row = await queryOne<{ club_id: string }>(
    `SELECT club_id::text FROM alliance_clubs WHERE alliance_id = $1::uuid ORDER BY joined_at LIMIT 1`,
    [a.alliance_id]
  )
  return row?.club_id ?? null
}

export async function canManageAlliance(session: Session, a: Alliance) {
  const owner = await effectiveOwnerId(a)
  return !!owner && ownsClub(session, owner)
}

/** Day gain on the member's newest row: the 1st counts from zero, anything else needs the day before. */
function dayGain(fans: number, prevFans: number | null, prevDate: string | null, on: string): number | null {
  if (on.endsWith('-01')) return fans
  if (prevFans === null || !prevDate) return null
  const gapDays = (Date.parse(on) - Date.parse(prevDate)) / 86_400_000
  return gapDays === 1 ? Math.max(0, fans - prevFans) : null
}

export async function loadStandings(allianceId: string): Promise<Standings> {
  const clubs = await getAllianceClubs(allianceId)
  const empty: Standings = {
    month: null, latestDate: null, trainers: [],
    clubs: clubs.map(c => ({ ...c, members: 0, fans: 0, day_gain: 0, avg: 0 })),
  }
  if (!clubs.length) return empty
  const ids = clubs.map(c => c.club_id)

  const latest = await queryOne<{ d: string | null }>(
    `SELECT MAX(date)::text AS d FROM quota_history WHERE club_id = ANY($1::uuid[])`, [ids]
  )
  const latestDate = latest?.d ?? null
  if (!latestDate) return empty
  const month = latestDate.slice(0, 7)

  const rows = await query<{
    member_id: string; trainer_name: string; club_id: string
    fans: string; date: string; prev_fans: string | null; prev_date: string | null
  }>(
    `SELECT m.member_id::text, m.trainer_name, m.club_id::text,
            lat.cumulative_fans::text AS fans, lat.date::text,
            prev.cumulative_fans::text AS prev_fans, prev.date::text AS prev_date
     FROM members m
     JOIN LATERAL (
       SELECT cumulative_fans, date FROM quota_history
       WHERE member_id = m.member_id AND club_id = m.club_id
         AND date >= $2::date AND date < ($2::date + INTERVAL '1 month')
       ORDER BY date DESC LIMIT 1
     ) lat ON true
     LEFT JOIN LATERAL (
       SELECT cumulative_fans, date FROM quota_history
       WHERE member_id = m.member_id AND club_id = m.club_id
         AND date >= $2::date AND date < lat.date
       ORDER BY date DESC LIMIT 1
     ) prev ON true
     WHERE m.club_id = ANY($1::uuid[]) AND m.is_active
     ORDER BY lat.cumulative_fans DESC, m.trainer_name`,
    [ids, `${month}-01`]
  )

  const byId = new Map(empty.clubs.map(c => [c.club_id, c]))
  const trainers: TrainerRow[] = rows.map(r => {
    const fans = Number(r.fans)
    const gain = dayGain(fans, r.prev_fans === null ? null : Number(r.prev_fans), r.prev_date, r.date)
    const club = byId.get(r.club_id)!
    club.members += 1
    club.fans += fans
    // "today" is the alliance's newest day; a club a scrape behind adds nothing
    if (r.date === latestDate) club.day_gain += gain ?? 0
    return {
      member_id: r.member_id, trainer_name: r.trainer_name, club_id: r.club_id,
      club_name: club.club_name, fans, day_gain: gain,
    }
  })
  for (const c of byId.values()) c.avg = c.members ? Math.round(c.fans / c.members) : 0

  return {
    month,
    latestDate,
    trainers,
    clubs: [...byId.values()].sort((a, b) => b.fans - a.fans || a.club_name.localeCompare(b.club_name)),
  }
}

// no 0/O/1/I so codes survive being read out in voice chat
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newInviteCode() {
  return Array.from({ length: 8 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')
}

export function normalizeCode(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function cleanName(s: unknown) {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

/** URL slug from the name, made unique with -2, -3, ... */
export async function uniqueSlug(name: string, exceptId?: string) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'alliance'
  const taken = new Set(
    (await query<{ slug: string }>(
      `SELECT slug FROM alliances WHERE (slug = $1 OR slug LIKE $1 || '-%')
         AND ($2::uuid IS NULL OR alliance_id <> $2::uuid)`,
      [base, exceptId ?? null]
    )).map(r => r.slug)
  )
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
}
