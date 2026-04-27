import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import SyncButton from './SyncButton'

type Entry = {
  member_id: string
  trainer_name: string
  club_id: string
  cumulative_fans: string
  deficit_surplus: string
  days_behind: string
  days_remaining: string | null
  bomb_active: boolean | null
}

type ClubInfo = {
  club_id: string
  club_name: string
  circle_id: string | null
  daily_quota: string
  quota_period: string
  missing_days: number
}

function formatFans(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`
  return String(n)
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: dateParam } = await searchParams

  const session = await auth()
  const guildIds = session?.adminGuildIds ?? []

  const dates = await query<{ date: string }>(
    `SELECT DISTINCT qh.date::text
     FROM quota_history qh
     JOIN clubs c ON c.club_id = qh.club_id
     WHERE c.guild_id::text = ANY($1::text[])
     ORDER BY qh.date DESC LIMIT 90`,
    [guildIds]
  ).catch(() => [] as { date: string }[])

  const availableDates = dates.map(d => d.date)
  const latestDate = availableDates[0] ?? null
  const selectedDate =
    dateParam && availableDates.includes(dateParam) ? dateParam : latestDate

  const idx = selectedDate ? availableDates.indexOf(selectedDate) : -1
  const prevDate = idx >= 0 && idx < availableDates.length - 1 ? availableDates[idx + 1] : null
  const nextDate = idx > 0 ? availableDates[idx - 1] : null

  const clubs = await query<ClubInfo>(`
    WITH first_entry AS (
      SELECT club_id, MIN(date) AS first_date
      FROM quota_history
      WHERE date >= date_trunc('month', CURRENT_DATE)::date
      GROUP BY club_id
    ),
    synced AS (
      SELECT club_id, COUNT(DISTINCT date)::int AS synced_days
      FROM quota_history
      WHERE date >= date_trunc('month', CURRENT_DATE)::date
        AND date < CURRENT_DATE
      GROUP BY club_id
    )
    SELECT
      c.club_id, c.club_name, c.circle_id,
      c.daily_quota::text, c.quota_period,
      CASE
        WHEN f.first_date IS NULL THEN 0
        ELSE GREATEST(0,
          (CURRENT_DATE - f.first_date)::int
          - COALESCE(s.synced_days, 0)
        )
      END AS missing_days
    FROM clubs c
    LEFT JOIN first_entry f ON f.club_id = c.club_id
    LEFT JOIN synced s ON s.club_id = c.club_id
    WHERE c.is_active = true
      AND c.guild_id::text = ANY($1::text[])
    ORDER BY c.club_name
  `, [guildIds]).catch(() => [] as ClubInfo[])

  const entries = selectedDate
    ? await query<Entry>(`
        SELECT
          m.member_id, m.trainer_name,
          c.club_id,
          qh.cumulative_fans::text, qh.deficit_surplus::text, qh.days_behind::text,
          b.days_remaining::text, b.is_active AS bomb_active
        FROM quota_history qh
        JOIN members m ON m.member_id = qh.member_id AND m.is_active = true
        JOIN clubs   c ON c.club_id   = qh.club_id
        LEFT JOIN bombs b ON b.member_id = m.member_id AND b.is_active = true
        WHERE qh.date = $1
          AND c.guild_id::text = ANY($2::text[])
        ORDER BY c.club_name, qh.deficit_surplus DESC
      `, [selectedDate, guildIds]).catch(() => [] as Entry[])
    : []

  const byClub: Record<string, Entry[]> = {}
  for (const e of entries) {
    ;(byClub[e.club_id] ??= []).push(e)
  }

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Daily Report</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Quota status snapshot by club</p>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-1.5">
          {prevDate ? (
            <Link href={`?date=${prevDate}`}
              className="px-3 py-1.5 text-xs rounded-lg bg-[#0d0d14] border border-white/5 text-zinc-400 hover:text-white transition-colors">
              ← Prev
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-xs rounded-lg bg-[#0d0d14] border border-white/5 text-zinc-700">← Prev</span>
          )}
          <span className="px-4 py-1.5 text-xs rounded-lg bg-[#0d0d14] border border-white/5 text-white font-medium min-w-[130px] text-center">
            {selectedDate ? fmtDate(selectedDate) : '—'}
          </span>
          {nextDate ? (
            <Link href={`?date=${nextDate}`}
              className="px-3 py-1.5 text-xs rounded-lg bg-[#0d0d14] border border-white/5 text-zinc-400 hover:text-white transition-colors">
              Next →
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-xs rounded-lg bg-[#0d0d14] border border-white/5 text-zinc-700">Next →</span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!selectedDate && (
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-12 text-center">
          <p className="text-sm text-zinc-400 mb-1">No quota data yet</p>
          <p className="text-xs text-zinc-700">Use the Sync button on a club to pull data from uma.moe</p>
        </div>
      )}

      {/* Per-club reports */}
      {clubs.map(club => {
        const clubEntries = byClub[club.club_id] ?? []
        const onTrack = clubEntries.filter(e => Number(e.deficit_surplus) >= 0)
        const behind  = clubEntries.filter(e => Number(e.deficit_surplus) < 0)
        const bombCount = clubEntries.filter(e => e.bomb_active).length

        return (
          <div key={club.club_id} className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
            {/* Club header */}
            <div className="px-5 py-4 border-b border-white/5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <p className="text-sm font-medium text-white">{club.club_name}</p>
                  <span className="text-xs text-zinc-600 capitalize">{club.quota_period}</span>
                  <span className="text-xs text-zinc-600">{formatFans(Number(club.daily_quota))}/day</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-400">{onTrack.length} on track</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-amber-400">{behind.length} behind</span>
                    {bombCount > 0 && (
                      <><span className="text-zinc-700">·</span>
                      <span className="text-red-400">💣 {bombCount}</span></>
                    )}
                  </div>
                  <SyncButton clubId={club.club_id} hasCircleId={!!club.circle_id} />
                </div>
              </div>

              {club.missing_days > 0 && (
                <p className="mt-2 text-xs text-amber-500/80">
                  ⚠ {club.missing_days} day{club.missing_days !== 1 ? 's' : ''} missing this month — hit Sync to backfill
                </p>
              )}
            </div>

            {/* No data for this date */}
            {clubEntries.length === 0 && selectedDate && (
              <p className="px-5 py-6 text-xs text-zinc-600 text-center">
                No data for this date — sync to pull latest from uma.moe
              </p>
            )}

            {/* Member columns */}
            {clubEntries.length > 0 && (
              <div className="grid grid-cols-2 divide-x divide-white/5">
                {/* On track */}
                <div>
                  <div className="px-5 py-2.5 border-b border-white/5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-zinc-400">On Track</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {onTrack.map(e => (
                      <div key={e.member_id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-200 truncate">{e.trainer_name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-zinc-600">{formatFans(Number(e.cumulative_fans))}</span>
                          <span className="text-xs font-medium text-emerald-400">
                            +{formatFans(Number(e.deficit_surplus))}
                          </span>
                        </div>
                      </div>
                    ))}
                    {onTrack.length === 0 && (
                      <p className="px-5 py-4 text-xs text-zinc-700">None</p>
                    )}
                  </div>
                </div>

                {/* Behind */}
                <div>
                  <div className="px-5 py-2.5 border-b border-white/5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="text-xs font-medium text-zinc-400">Behind</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {behind.map(e => (
                      <div key={e.member_id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-zinc-200 truncate">{e.trainer_name}</span>
                          {e.bomb_active && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              Number(e.days_remaining) <= 2 ? 'bg-red-500/15 text-red-400'
                              : Number(e.days_remaining) <= 4 ? 'bg-orange-500/15 text-orange-400'
                              : 'bg-amber-500/15 text-amber-400'
                            }`}>
                              💣 {e.days_remaining}d
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-zinc-600">{formatFans(Number(e.cumulative_fans))}</span>
                          <span className="text-xs font-medium text-amber-400">
                            {formatFans(Number(e.deficit_surplus))}
                          </span>
                          {Number(e.days_behind) > 0 && (
                            <span className="text-[10px] text-zinc-600">{e.days_behind}d</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {behind.length === 0 && (
                      <p className="px-5 py-4 text-xs text-zinc-700">None</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
