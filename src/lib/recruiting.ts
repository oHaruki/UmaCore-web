import { query, queryOne } from './db'
import { EFFECTIVE_QUOTA_SQL } from './quota'
import { LISTED_DAYS, type ClubListing, type PlayerListing } from './recruiting-shared'

// Club numbers come straight from the club's latest scrape, so a listing is
// always as fresh as the daily report. Post columns are COALESCEd so the same
// select also previews a club that has no listing yet.
const CLUB_COLUMNS = `
  c.club_id::text, c.club_name, COALESCE(p.headline, '') AS headline,
  COALESCE(p.description, '') AS description, p.discord_invite,
  COALESCE(p.discord_required, false) AS discord_required,
  p.min_daily_fans::float8 AS min_daily_fans, p.language,
  COALESCE(p.tags, '{}') AS tags, p.accent, p.banner_image_id::text,
  COALESCE(p.is_open, true) AS is_open,
  COALESCE(p.bumped_at, NOW())::text AS bumped_at, COALESCE(p.updated_at, NOW())::text AS updated_at,
  CASE WHEN c.public_enabled THEN c.public_slug END AS public_slug,
  ${EFFECTIVE_QUOTA_SQL}::float8 AS quota, c.quota_period, c.bombs_enabled,
  COALESCE(mem.members, 0) AS members, r.club_rank,
  d.latest_date, d.total_fans, COALESCE(d.tracked, 0) AS tracked,
  COALESCE(d.on_track, 0) AS on_track
`
const CLUB_STATS_JOINS = `
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS members FROM members m
    WHERE m.club_id = c.club_id AND m.is_active
  ) mem ON true
  LEFT JOIN LATERAL (
    SELECT club_rank FROM club_rank_history
    WHERE club_id = c.club_id ORDER BY date DESC LIMIT 1
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT qh.date::text AS latest_date,
           SUM(qh.cumulative_fans)::float8 AS total_fans,
           COUNT(*)::int AS tracked,
           (COUNT(*) FILTER (WHERE qh.deficit_surplus >= 0))::int AS on_track
    FROM quota_history qh
    JOIN members m ON m.member_id = qh.member_id AND m.is_active
    WHERE qh.club_id = c.club_id
      AND qh.date = (SELECT MAX(date) FROM quota_history WHERE club_id = c.club_id)
    GROUP BY qh.date
  ) d ON true
`
const CLUB_POSTS = `SELECT ${CLUB_COLUMNS} FROM recruit_club_posts p JOIN clubs c ON c.club_id = p.club_id ${CLUB_STATS_JOINS}`

const PLAYER_SELECT = `
  SELECT p.post_id::text, p.discord_user_id::text, p.discord_name, p.discord_avatar,
         p.trainer_id, p.trainer_name, p.min_grade, p.daily_fans::float8 AS daily_fans,
         p.description, p.language, p.tags, p.stats,
         p.stats_updated_at::text, p.is_open,
         EXISTS (
           SELECT 1 FROM user_links ul JOIN members m ON m.member_id = ul.member_id
           WHERE ul.discord_user_id = p.discord_user_id AND m.trainer_id = p.trainer_id
         ) AS linked,
         p.bumped_at::text, p.updated_at::text
  FROM recruit_player_posts p
`

const LISTED = `p.is_open AND p.bumped_at > NOW() - INTERVAL '${LISTED_DAYS} days'`

export async function listClubPosts(): Promise<ClubListing[]> {
  return query<ClubListing>(`${CLUB_POSTS} WHERE ${LISTED} AND c.is_active ORDER BY p.bumped_at DESC LIMIT 300`)
}

export async function listPlayerPosts(): Promise<PlayerListing[]> {
  return query<PlayerListing>(`${PLAYER_SELECT} WHERE ${LISTED} ORDER BY p.bumped_at DESC LIMIT 300`)
}

/** A club's listing whether or not it is listed right now, for direct links. */
export async function getClubPost(clubId: string): Promise<ClubListing | null> {
  return queryOne<ClubListing>(`${CLUB_POSTS} WHERE p.club_id = $1::uuid AND c.is_active`, [clubId])
}

/** The club's listing for its editor, with live stats even before one exists. */
export async function getClubForEditor(clubId: string): Promise<(ClubListing & { has_post: boolean }) | null> {
  return queryOne(
    `SELECT ${CLUB_COLUMNS}, (p.club_id IS NOT NULL) AS has_post
     FROM clubs c LEFT JOIN recruit_club_posts p ON p.club_id = c.club_id
     ${CLUB_STATS_JOINS}
     WHERE c.club_id = $1::uuid`,
    [clubId]
  )
}

export async function getPlayerPost(postId: string): Promise<PlayerListing | null> {
  return queryOne<PlayerListing>(`${PLAYER_SELECT} WHERE p.post_id = $1::uuid`, [postId])
}

export async function getPlayerPostByDiscord(discordId: string): Promise<PlayerListing | null> {
  return queryOne<PlayerListing>(`${PLAYER_SELECT} WHERE p.discord_user_id = $1::bigint`, [discordId])
}

/** The trainer linked to this Discord account with /link_trainer, to prefill an LFC post. */
export async function getLinkedTrainer(discordId: string) {
  return queryOne<{ trainer_id: string; trainer_name: string }>(
    `SELECT m.trainer_id, m.trainer_name FROM user_links ul
     JOIN members m ON m.member_id = ul.member_id
     WHERE ul.discord_user_id = $1::bigint AND m.trainer_id IS NOT NULL`,
    [discordId]
  )
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
