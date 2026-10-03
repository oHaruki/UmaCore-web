import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import Link from 'next/link'
import { History, ArrowUpRight } from 'lucide-react'
import { formatDay, formatDelta, formatFans } from '@/lib/format'
import { isMonthKey, monthStart, monthLabel, daysInMonth, inMonthSql } from '@/lib/month'
import { PageHeader, Panel, Stat, StatStrip, Chip, Avatar, EmptyState, NoClub } from '@/components/dash/ui'
import MonthStepper from '@/components/dash/MonthStepper'
import QuotaChart, { QuotaChartLegend } from '@/components/QuotaChart'

type BoardRow = {
  member_id: string
  trainer_name: string
  trainer_id: string
  is_active: boolean
  last_date: string
  cumulative_fans: string
  expected_fans: string
  deficit_surplus: string
  days_behind: string
  days: number[]
  ok: boolean[]
}

type DayRow = {
  member_id: string
  trainer_name: string
  date: string
  cumulative_fans: string
  expected_fans: string
  deficit_surplus: string
  days_behind: string
}

export default async function QuotaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; trainer?: string }>
}) {
  const { month: monthParam, trainer } = await searchParams

  const session = await auth()
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  if (!active) return <NoClub title="Quota history" />

  // Months that have at least one daily check, newest first.
  const months = (await query<{ m: string }>(`
    SELECT DISTINCT to_char(date, 'YYYY-MM') AS m
    FROM quota_history WHERE club_id = $1
    ORDER BY m DESC LIMIT 36
  `, [active.club_id]).catch(() => [])).map(r => r.m)

  if (!months.length) {
    return (
      <div className="rise space-y-6">
        <PageHeader title="Quota history" />
        <div className="panel">
          <EmptyState icon={History} title="No quota data yet" body="Months show up here after the club's first daily check." />
        </div>
      </div>
    )
  }

  const month = isMonthKey(monthParam) && months.includes(monthParam) ? monthParam : months[0]
  const start = monthStart(month)
  const href = (m: string, t?: string) => `?month=${m}${t ? `&trainer=${encodeURIComponent(t)}` : ''}`

  if (trainer) {
    return <TrainerMonth clubId={active.club_id} month={month} months={months} trainer={trainer} href={href} />
  }

  const [board, meta] = await Promise.all([
    query<BoardRow>(`
      SELECT m.member_id::text, m.trainer_name, m.trainer_id, m.is_active,
             last.date::text AS last_date, last.cumulative_fans::text, last.expected_fans::text,
             last.deficit_surplus::text, last.days_behind::text,
             d.days, d.ok
      FROM (
        SELECT DISTINCT member_id FROM quota_history
        WHERE club_id = $1 AND ${inMonthSql('date', '$2')}
      ) x
      JOIN members m ON m.member_id = x.member_id
      JOIN LATERAL (
        SELECT date, cumulative_fans, expected_fans, deficit_surplus, days_behind
        FROM quota_history
        WHERE member_id = m.member_id AND club_id = $1 AND ${inMonthSql('date', '$2')}
        ORDER BY date DESC LIMIT 1
      ) last ON true
      JOIN LATERAL (
        SELECT array_agg(EXTRACT(DAY FROM date)::int ORDER BY date) AS days,
               array_agg(deficit_surplus >= 0 ORDER BY date) AS ok
        FROM quota_history
        WHERE member_id = m.member_id AND club_id = $1 AND ${inMonthSql('date', '$2')}
      ) d ON true
      ORDER BY last.deficit_surplus DESC, m.trainer_name
    `, [active.club_id, start]).catch(() => [] as BoardRow[]),
    query<{ checks: number; last: string | null }>(`
      SELECT COUNT(DISTINCT date)::int AS checks, MAX(date)::text AS last
      FROM quota_history WHERE club_id = $1 AND ${inMonthSql('date', '$2')}
    `, [active.club_id, start]).catch(() => []),
  ])

  const checks = meta[0]?.checks ?? 0
  const lastCheck = meta[0]?.last ?? null
  const onTrack = board.filter(r => Number(r.deficit_surplus) >= 0).length
  const pct = board.length ? Math.round((onTrack / board.length) * 100) : null
  const avg = board.length ? Math.round(board.reduce((s, r) => s + Number(r.deficit_surplus), 0) / board.length) : 0
  const totalFans = board.reduce((s, r) => s + Number(r.cumulative_fans), 0)
  const nDays = daysInMonth(month)

  return (
    <div className="rise space-y-6">
      <PageHeader
        title="Quota history"
        description="One month at a time, the way the bot counts it. Fan totals start again on the 1st."
        actions={<MonthStepper month={month} months={months} href={m => href(m)} />}
      />

      <StatStrip>
        <Stat label="Members tracked" value={board.length} />
        <Stat
          label={month === months[0] ? 'On track now' : 'On track at month end'}
          value={pct !== null ? `${pct}%` : '–'}
          tone={pct === null ? 'neutral' : pct >= 80 ? 'good' : 'warn'}
          hint={`${onTrack} of ${board.length}`}
        />
        <Stat label="Average surplus" value={formatDelta(avg)} tone={avg >= 0 ? 'good' : 'warn'} />
        <Stat label="Club fans this month" value={formatFans(totalFans)} />
        <Stat
          label="Daily checks"
          value={checks}
          hint={lastCheck ? `Latest ${formatDay(lastCheck)}` : undefined}
        />
      </StatStrip>

      <Panel
        title={monthLabel(month)}
        description="Each member's standing at their latest check this month. Click a trainer for their day-by-day numbers."
        action={
          <div className="hidden items-center gap-3 text-xs text-fg-muted md:flex">
            <span className="flex items-center gap-1.5"><span className="h-3 w-1.5 rounded-sm bg-good" />On track</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-1.5 rounded-sm bg-warn" />Behind</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-1.5 rounded-sm bg-surface-3" />No check</span>
          </div>
        }
        flush
      >
        {board.length ? (
          <div className="overflow-x-auto border-t border-line">
            <table className="table-ui">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Trainer</th>
                  <th className="text-right">Fans</th>
                  <th className="hidden text-right sm:table-cell">Expected</th>
                  <th className="text-right">Surplus</th>
                  <th className="hidden lg:table-cell">Daily checks</th>
                  <th className="hidden text-right md:table-cell">Days behind</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r, i) => {
                  const surplus = Number(r.deficit_surplus)
                  const byDay = new Map(r.days.map((d, k) => [d, r.ok[k]]))
                  return (
                    <tr key={r.member_id} className="group">
                      <td className="num text-fg-subtle">{i + 1}</td>
                      <td>
                        <Link href={href(month, r.trainer_id)} scroll={false} className="flex items-center gap-3">
                          <Avatar name={r.trainer_name} size={28} className={r.is_active ? '' : 'opacity-50'} />
                          <span className="min-w-0 truncate font-medium text-fg-soft transition-colors group-hover:text-fg">{r.trainer_name}</span>
                          {!r.is_active && <Chip>Inactive</Chip>}
                        </Link>
                      </td>
                      <td className="num text-right text-fg-soft">{formatFans(Number(r.cumulative_fans))}</td>
                      <td className="num hidden text-right text-fg-subtle sm:table-cell">{formatFans(Number(r.expected_fans))}</td>
                      <td className={`num text-right font-medium ${surplus >= 0 ? 'text-good' : 'text-warn'}`}>{formatDelta(surplus)}</td>
                      <td className="hidden lg:table-cell">
                        <div className="flex gap-[2px]" aria-label={`${r.ok.filter(Boolean).length} of ${r.days.length} checks on track`}>
                          {Array.from({ length: nDays }, (_, k) => {
                            const ok = byDay.get(k + 1)
                            return (
                              <span
                                key={k}
                                title={`${formatDay(`${month}-${String(k + 1).padStart(2, '0')}`)}: ${ok === undefined ? 'no check' : ok ? 'on track' : 'behind'}`}
                                className={`h-4 w-1.5 rounded-sm ${ok === undefined ? 'bg-surface-3' : ok ? 'bg-good' : 'bg-warn'}`}
                              />
                            )
                          })}
                        </div>
                      </td>
                      <td className={`num hidden text-right md:table-cell ${Number(r.days_behind) > 0 ? 'text-warn' : 'text-fg-subtle'}`}>
                        {Number(r.days_behind) > 0 ? `${r.days_behind}d` : '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={History} title={`No checks in ${monthLabel(month)}`} className="border-t border-line" />
        )}
      </Panel>
    </div>
  )
}

async function TrainerMonth({
  clubId,
  month,
  months,
  trainer,
  href,
}: {
  clubId: string
  month: string
  months: string[]
  trainer: string
  href: (m: string, t?: string) => string
}) {
  const rows = await query<DayRow>(`
    SELECT m.member_id::text, m.trainer_name, qh.date::text,
           qh.cumulative_fans::text, qh.expected_fans::text,
           qh.deficit_surplus::text, qh.days_behind::text
    FROM quota_history qh
    JOIN members m ON m.member_id = qh.member_id
    WHERE qh.club_id = $1 AND m.trainer_id = $3 AND ${inMonthSql('qh.date', '$2')}
    ORDER BY qh.date ASC
  `, [clubId, monthStart(month), trainer]).catch(() => [] as DayRow[])

  const name = rows[0]?.trainer_name ?? trainer
  const last = rows[rows.length - 1]
  const onTrack = rows.filter(r => Number(r.deficit_surplus) >= 0).length
  const surplus = last ? Number(last.deficit_surplus) : null

  return (
    <div className="rise space-y-6">
      <PageHeader
        back={{ href: href(month), label: `All members, ${monthLabel(month)}` }}
        title={
          <span className="flex items-center gap-3.5">
            <Avatar name={name} size={40} />
            <span className="min-w-0 truncate">{name}</span>
          </span>
        }
        meta={
          <>
            {rows[0] && (
              <Link href={`/dashboard/members/${rows[0].member_id}`} className="link inline-flex items-center gap-1 text-[13px]">
                Member page <ArrowUpRight size={13} strokeWidth={1.75} />
              </Link>
            )}
          </>
        }
        actions={<MonthStepper month={month} months={months} href={m => href(m, trainer)} />}
      />

      {rows.length === 0 ? (
        <div className="panel">
          <EmptyState icon={History} title={`No checks for ${name} in ${monthLabel(month)}`} body="Try another month with the arrows above." />
        </div>
      ) : (
        <>
          <StatStrip>
            <Stat label="Fans this month" value={formatFans(Number(last.cumulative_fans))} />
            <Stat label="Surplus" value={surplus !== null ? formatDelta(surplus) : '–'} tone={surplus !== null && surplus >= 0 ? 'good' : 'warn'} />
            <Stat label="Checks on track" value={`${onTrack} of ${rows.length}`} tone={onTrack === rows.length ? 'good' : 'neutral'} />
            <Stat label="Days behind at last check" value={Number(last.days_behind) > 0 ? last.days_behind : '–'} tone={Number(last.days_behind) > 0 ? 'warn' : 'neutral'} />
          </StatStrip>

          {rows.length >= 2 && (
            <Panel title="Fans through the month" action={<QuotaChartLegend />}>
              <QuotaChart data={rows.map(r => ({ date: r.date, cumulative: Number(r.cumulative_fans), expected: Number(r.expected_fans) }))} />
            </Panel>
          )}

          <Panel title="Daily checks" description={`${rows.length} in ${monthLabel(month)}`} flush>
            <div className="overflow-x-auto border-t border-line">
              <table className="table-ui">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Fans</th>
                    <th className="hidden text-right sm:table-cell">Expected</th>
                    <th className="text-right">Surplus</th>
                    <th className="text-right">Days behind</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map(r => {
                    const val = Number(r.deficit_surplus)
                    return (
                      <tr key={r.date}>
                        <td className="num text-fg-muted">{formatDay(r.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                        <td className="num text-right text-fg-soft">{formatFans(Number(r.cumulative_fans))}</td>
                        <td className="num hidden text-right text-fg-subtle sm:table-cell">{formatFans(Number(r.expected_fans))}</td>
                        <td className={`num text-right font-medium ${val >= 0 ? 'text-good' : 'text-warn'}`}>{formatDelta(val)}</td>
                        <td className={`num text-right ${Number(r.days_behind) > 0 ? 'text-warn' : 'text-fg-subtle'}`}>
                          {Number(r.days_behind) > 0 ? `${r.days_behind}d` : '–'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
