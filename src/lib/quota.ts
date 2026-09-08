/**
 * The quota a club is actually running on today, as a SQL expression.
 *
 * `clubs.daily_quota` is only the fallback. `/quota` records a dated row in
 * `quota_requirements` and never writes back to the club, so reading the column
 * directly reports whatever the quota was when the club was first set up — the
 * figure the bot stopped using the moment anyone changed it. Every surface that
 * shows "the quota" has to resolve it the same way the bot does, or the
 * dashboard quietly disagrees with the reports going out in Discord.
 *
 * Mirrors `QuotaSchedule.for_date` (UmaCore/models/quota_requirement.py): the
 * latest requirement effective on or before today, else the club's default. The
 * `created_at` tiebreaker matches that class's newest-wins collapse of two
 * requirements sharing one effective_date, including its preference for a real
 * timestamp over a NULL one.
 *
 * `CURRENT_DATE` is the database's date rather than the club's. The two differ
 * only in the hours around midnight, and only on a day the quota changed —
 * deliberately preferred over `AT TIME ZONE c.timezone`, which throws on a
 * malformed zone and would take the whole page down with it, since that column
 * is free text.
 *
 * Requires the clubs table to be aliased `c`.
 */
export const EFFECTIVE_QUOTA_SQL = `COALESCE((
  SELECT qr.daily_quota
  FROM quota_requirements qr
  WHERE qr.club_id = c.club_id
    AND qr.effective_date <= CURRENT_DATE
  ORDER BY qr.effective_date DESC, qr.created_at DESC NULLS LAST
  LIMIT 1
), c.daily_quota)`
