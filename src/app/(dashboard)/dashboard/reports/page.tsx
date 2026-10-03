import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarX2, AlertTriangle } from 'lucide-react'
import { formatDay, formatDelta, formatFans } from '@/lib/format'
import { PageHeader, Chip, EmptyState, NoClub, Avatar } from '@/components/dash/ui'
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: dateParam } = await searchParams

  const session = await auth()
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  if (!active) return <NoClub title="Daily report" />

  const dates = await query<{ date: string }>(
    `SELECT DISTINCT qh.date::text AS date
     FROM quota_history qh
     JOIN clubs c ON c.club_id::text = qh.club_id::text
     WHERE c.club_id = $1
     ORDER BY qh.date::text DESC LIMIT 90`,
    [active.club_id]
  ).catch((e) => { console.error('[reports dates]', e); return [] as { date: string }[] })

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
      AND c.club_id = $1
    ORDER BY c.club_name
  `, [active.club_id]).catch(() => [] as ClubInfo[])

  const entries = selectedDate
    ? await query<Entry>(`
        SELECT
          m.member_id, m.trainer_name,
          c.club_id,
          qh.cumulative_fans::text, qh.deficit_surplus::text, qh.days_behind::text,
          b.days_remaining::text, b.is_active AS bomb_active
        FROM quota_history qh
        JOIN members m ON m.member_id = qh.member_id AND m.is_active = true
        JOIN clubs   c ON c.club_id::text = qh.club_id::text
        LEFT JOIN bombs b ON b.member_id = m.member_id AND b.is_active = true
        WHERE qh.date = $1
          AND c.club_id = $2
        ORDER BY c.club_name, qh.deficit_surplus DESC
      `, [selectedDate, active.club_id]).catch((e) => { console.error('[reports entries]', e); return [] as Entry[] })
    : []

  const byClub: Record<string, Entry[]> = {}
  for (const e of entries) {
    ;(byClub[e.club_id] ??= []).push(e)
  }

  const stepCls = 'grid size-9 place-items-center rounded-[10px] transition-colors'

  return (
    <div className="rise space-y-6">
      <PageHeader
        title="Daily report"
        description="Who was on track at each daily check. Step back through up to 90 days."
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
            {prevDate ? (
              <Link href={`?date=${prevDate}`} className={`${stepCls} text-fg-muted hover:bg-surface-2 hover:text-fg`} aria-label="Previous day">
                <ChevronLeft size={16} strokeWidth={1.75} />
              </Link>
            ) : (
              <span className={`${stepCls} text-fg-subtle/40`} aria-hidden><ChevronLeft size={16} strokeWidth={1.75} /></span>
            )}
            <span className="num min-w-36 px-2 text-center text-[13px] font-medium text-fg">
              {selectedDate ? formatDay(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' }) : 'No data'}
              {selectedDate === latestDate && selectedDate && <span className="ml-1.5 text-xs font-normal text-brand">latest</span>}
            </span>
            {nextDate ? (
              <Link href={`?date=${nextDate}`} className={`${stepCls} text-fg-muted hover:bg-surface-2 hover:text-fg`} aria-label="Next day">
                <ChevronRight size={16} strokeWidth={1.75} />
              </Link>
            ) : (
              <span className={`${stepCls} text-fg-subtle/40`} aria-hidden><ChevronRight size={16} strokeWidth={1.75} /></span>
            )}
          </div>
        }
      />

      {!selectedDate && (
        <div className="panel">
          <EmptyState
            icon={CalendarX2}
            title="No quota data yet"
            body="Sync the club to pull its numbers from uma.moe."
            action={clubs[0] && <SyncButton clubId={clubs[0].club_id} hasCircleId={!!clubs[0].circle_id} />}
          />
        </div>
      )}

      {clubs.map(club => {
        const clubEntries = byClub[club.club_id] ?? []
        const onTrack = clubEntries.filter(e => Number(e.deficit_surplus) >= 0)
        const behind  = clubEntries.filter(e => Number(e.deficit_surplus) < 0)
        const bombCount = clubEntries.filter(e => e.bomb_active).length

        return (
          <section key={club.club_id} className="panel overflow-hidden">
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold text-fg">{club.club_name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Chip tone="good">{onTrack.length} on track</Chip>
                  <Chip tone={behind.length ? 'warn' : 'neutral'}>{behind.length} behind</Chip>
                  {bombCount > 0 && <Chip tone="bad">💣 {bombCount}</Chip>}
                </div>
              </div>
              <SyncButton clubId={club.club_id} hasCircleId={!!club.circle_id} />
            </div>

            {club.missing_days > 0 && (
              <p className="flex items-center gap-2 border-t border-line bg-warn/6 px-5 py-2.5 text-[13px] text-warn">
                <AlertTriangle size={14} strokeWidth={1.75} />
                {club.missing_days} day{club.missing_days !== 1 ? 's' : ''} missing this month. Sync to backfill them.
              </p>
            )}

            {clubEntries.length === 0 && selectedDate && (
              <p className="border-t border-line px-5 py-8 text-center text-[13px] text-fg-subtle">
                No data for this date. Sync to pull the latest from uma.moe.
              </p>
            )}

            {clubEntries.length > 0 && (
              <div className="grid grid-cols-1 border-t border-line md:grid-cols-2 md:divide-x md:divide-line">
                <ReportColumn title="On track" tone="good" entries={onTrack} />
                <ReportColumn title="Behind" tone="warn" entries={behind} className="border-t border-line md:border-t-0" />
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function ReportColumn({
  title,
  tone,
  entries,
  className = '',
}: {
  title: string
  tone: 'good' | 'warn'
  entries: Entry[]
  className?: string
}) {
  return (
    <div className={className}>
      <p className="flex items-center justify-between px-5 pt-3 pb-2 text-xs font-medium text-fg-subtle">
        <span className={tone === 'good' ? 'text-good' : 'text-warn'}>{title}</span>
        <span className="num">{entries.length}</span>
      </p>
      <ul>
        {entries.map(e => {
          const surplus = Number(e.deficit_surplus)
          const bombDays = Number(e.days_remaining)
          return (
            <li key={e.member_id}>
              <Link
                href={`/dashboard/members/${e.member_id}`}
                className="flex items-center gap-3 px-5 py-2 transition-colors hover:bg-surface-2/60"
              >
                <Avatar name={e.trainer_name} size={24} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg-soft">{e.trainer_name}</span>
                {e.bomb_active && (
                  <Chip tone={bombDays <= 2 ? 'bad' : 'warn'}>💣 {e.days_remaining}d</Chip>
                )}
                {!e.bomb_active && Number(e.days_behind) > 0 && (
                  <span className="num text-xs text-fg-subtle">{e.days_behind}d</span>
                )}
                <span className="num hidden w-12 text-right text-xs text-fg-subtle sm:block">{formatFans(Number(e.cumulative_fans))}</span>
                <span className={`num w-14 text-right text-[13px] font-medium ${surplus >= 0 ? 'text-good' : 'text-warn'}`}>
                  {formatDelta(surplus)}
                </span>
              </Link>
            </li>
          )
        })}
        {entries.length === 0 && <li className="px-5 pb-4 text-[13px] text-fg-subtle">Nobody</li>}
      </ul>
      <div className="h-2" />
    </div>
  )
}
