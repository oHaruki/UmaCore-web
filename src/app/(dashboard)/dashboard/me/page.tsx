import { query, queryOne } from '@/lib/db'
import { auth } from '@/lib/auth'
import { EFFECTIVE_QUOTA_SQL } from '@/lib/quota'
import Link from 'next/link'
import { Flame, Link2 } from 'lucide-react'
import QuotaChart, { QuotaChartLegend } from '@/components/QuotaChart'
import { formatDelta, formatFans } from '@/lib/format'
import { monthLabel } from '@/lib/month'
import { PageHeader, Panel, Stat, StatStrip, Chip, Avatar, EmptyState } from '@/components/dash/ui'
import NotificationToggles from './NotificationToggles'

type Linked = {
  member_id: string
  trainer_name: string
  trainer_id: string | null
  is_active: boolean
  join_date: string | null
  club_id: string
  club_name: string
  daily_quota: string
  quota_period: string
  bombs_enabled: boolean
  bomb_trigger_days: number
  public_enabled: boolean
  public_slug: string | null
  notify_on_bombs: boolean
  notify_on_deficit: boolean
}

type HistoryEntry = {
  date: string
  cumulative_fans: string
  expected_fans: string
  deficit_surplus: string
  days_behind: number
}

type Standing = { pos: string; total: string }

type Transfer = {
  request_id: string
  to_club_name: string
  status: string
  decision_note: string | null
  decided_at: string | null
  created_at: string
  queue_pos: string | null
}

const statusTone = {
  pending: 'brand',
  approved: 'good',
  rejected: 'bad',
  cancelled: 'neutral',
} as const
const statusLabel: Record<string, string> = {
  pending: 'Waiting', approved: 'Approved', rejected: 'Declined', cancelled: 'Withdrawn',
}

/** Days between two YYYY-MM-DD strings, read as calendar dates rather than instants. */
function dayDiff(from: string, to: string) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000)
}

export default async function MyTrainerPage() {
  const session = await auth()
  const discordId = session?.user?.id ?? ''
  const hasDiscordId = /^\d+$/.test(discordId)

  const [linked, transfers] = hasDiscordId
    ? await Promise.all([
        queryOne<Linked>(`
          SELECT m.member_id::text, m.trainer_name, m.trainer_id, m.is_active, m.join_date::text,
                 c.club_id::text, c.club_name, ${EFFECTIVE_QUOTA_SQL}::text AS daily_quota,
                 c.quota_period, c.bombs_enabled, c.bomb_trigger_days,
                 c.public_enabled, c.public_slug,
                 ul.notify_on_bombs, ul.notify_on_deficit
          FROM user_links ul
          JOIN members m ON m.member_id = ul.member_id
          JOIN clubs c   ON c.club_id   = m.club_id
          WHERE ul.discord_user_id = $1::bigint
        `, [discordId]).catch(() => null),
        query<Transfer>(`
          SELECT tr.request_id::text, c.club_name AS to_club_name, tr.status,
                 tr.decision_note, tr.decided_at::text, tr.created_at::text,
                 CASE WHEN tr.status = 'pending' THEN (
                   SELECT COUNT(*) + 1 FROM transfer_requests p
                   WHERE p.to_club_id = tr.to_club_id AND p.status = 'pending'
                     AND p.created_at < tr.created_at
                 )::text END AS queue_pos
          FROM transfer_requests tr
          JOIN clubs c ON c.club_id = tr.to_club_id
          WHERE tr.discord_user_id = $1::bigint
          ORDER BY (tr.status = 'pending') DESC, COALESCE(tr.decided_at, tr.created_at) DESC
          LIMIT 10
        `, [discordId]).catch(() => []),
      ])
    : [null, [] as Transfer[]]

  if (!linked) {
    return (
      <div className="rise space-y-6">
        <Header />
        <div className="panel max-w-2xl">
          <EmptyState
            icon={Link2}
            title="No trainer linked to your Discord account yet"
            body="Link your trainer in any server where UmaCore tracks your club, then refresh this page."
            action={
              <div className="space-y-3">
                <code className="block rounded-[10px] border border-line bg-surface-2 px-4 py-3 text-left font-mono text-[13px] text-fg-soft">
                  /link_trainer trainer_name:<span className="text-brand">YourName</span> club:<span className="text-brand">YourClub</span>
                </code>
                <p className="mx-auto max-w-sm text-xs leading-relaxed text-fg-subtle">
                  The name has to match your in-game trainer name exactly. Your club must already be tracked by UmaCore, so ask a club leader if it isn&apos;t.
                </p>
              </div>
            }
          />
        </div>
        <TransferList transfers={transfers} />
      </div>
    )
  }

  const [history, bomb, standing] = await Promise.all([
    // quota_history keeps every month, and cumulative_fans restarts each one — so
    // only the latest month belongs on one chart.
    query<HistoryEntry>(`
      SELECT date::text, cumulative_fans::text, expected_fans::text,
             deficit_surplus::text, days_behind
      FROM quota_history
      WHERE member_id = $1
        AND date_trunc('month', date) = (
          SELECT date_trunc('month', MAX(date)) FROM quota_history WHERE member_id = $1
        )
      ORDER BY date ASC
    `, [linked.member_id]).catch(() => []),
    queryOne<{ days_remaining: number; activation_date: string }>(`
      SELECT days_remaining, activation_date::text
      FROM bombs WHERE member_id = $1 AND is_active
      ORDER BY activation_date DESC LIMIT 1
    `, [linked.member_id]).catch(() => null),
    // Position by fans this month among active members on the club's latest data day.
    queryOne<Standing>(`
      WITH day AS (SELECT MAX(date) AS d FROM quota_history WHERE club_id = $1),
      ranked AS (
        SELECT qh.member_id,
               RANK() OVER (ORDER BY qh.cumulative_fans DESC) AS pos,
               COUNT(*) OVER () AS total
        FROM quota_history qh
        JOIN members m ON m.member_id = qh.member_id AND m.is_active
        WHERE qh.club_id = $1 AND qh.date = (SELECT d FROM day)
      )
      SELECT pos::text, total::text FROM ranked WHERE member_id = $2
    `, [linked.club_id, linked.member_id]).catch(() => null),
  ])

  const latest = history[history.length - 1]

  // 'bi-weekly' is tolerated for clubs saved by an older dashboard build.
  const periodDays  = { daily: 1, weekly: 7, biweekly: 14, 'bi-weekly': 14 }[linked.quota_period] ?? 1
  const perDayQuota = Number(linked.daily_quota) / periodDays

  let stats: {
    fans: number; surplus: number; daysLeft: number; pace: number | null
    projected: number | null; target: number; catchUp: number | null; expectedNow: number
  } | null = null

  if (latest) {
    const [y, m, d] = latest.date.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const daysLeft = daysInMonth - d
    const fans     = Number(latest.cumulative_fans)
    const surplus  = Number(latest.deficit_surplus)

    // Recent pace: gain across the last week of data, or month-to-date when that's all there is.
    const windowStart = history.find(h => dayDiff(h.date, latest.date) <= 7) ?? latest
    const span = dayDiff(windowStart.date, latest.date)
    let pace: number | null = null
    if (span >= 1) {
      pace = (fans - Number(windowStart.cumulative_fans)) / span
    } else {
      const joinedThisMonth = linked.join_date?.slice(0, 7) === latest.date.slice(0, 7)
      const startDay = joinedThisMonth ? Number(linked.join_date!.slice(8, 10)) : 1
      const daysActive = d - startDay + 1
      pace = daysActive > 0 ? fans / daysActive : null
    }

    const target    = Number(latest.expected_fans) + perDayQuota * daysLeft
    const projected = pace !== null ? fans + pace * daysLeft : null
    const catchUp   = surplus < 0 && daysLeft > 0 ? perDayQuota + -surplus / daysLeft : null

    stats = { fans, surplus, daysLeft, pace, projected, target, catchUp, expectedNow: Number(latest.expected_fans) }
  }

  // Consecutive most-recent daily checks at or above quota.
  let streak = 0
  for (let i = history.length - 1; i >= 0 && Number(history[i].deficit_surplus) >= 0; i--) streak++

  const daysBehind = latest?.days_behind ?? 0
  const trigger    = linked.bomb_trigger_days
  const ahead      = stats ? stats.surplus >= 0 : true

  return (
    <div className="rise space-y-6">
      <Header />

      {/* Bomb / risk banner */}
      {bomb ? (
        <div className={`rounded-2xl border px-5 py-4 ${
          bomb.days_remaining <= 1 ? 'border-bad/30 bg-bad/8' : 'border-warn/25 bg-warn/6'
        }`}>
          <p className={`text-[15px] font-semibold ${bomb.days_remaining <= 1 ? 'text-bad' : 'text-warn'}`}>
            💣 Bomb active: {bomb.days_remaining} day{bomb.days_remaining === 1 ? '' : 's'} left
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
            It defuses at the first daily check where you&apos;re back at or above quota.
            {stats && stats.surplus < 0 && bomb.days_remaining > 0 && (
              <> You&apos;re {formatFans(-stats.surplus)} short, so about <span className="font-medium text-fg">{formatFans(Math.ceil(-stats.surplus / bomb.days_remaining))} extra a day</span> on top of quota clears it in time.</>
            )}
          </p>
        </div>
      ) : linked.bombs_enabled && linked.is_active && daysBehind > 0 && daysBehind < trigger ? (
        <div className="rounded-2xl border border-warn/20 bg-warn/6 px-5 py-4">
          <p className="text-[15px] font-semibold text-warn">
            Behind {daysBehind} day{daysBehind === 1 ? '' : 's'} in a row
          </p>
          <p className="mt-1 text-[13px] text-fg-muted">
            A bomb starts after {trigger} days in a row. Getting back on track at any daily check resets the count.
          </p>
        </div>
      ) : null}

      {/* Hero */}
      <section className="panel grid grid-cols-1 overflow-hidden lg:grid-cols-[1fr_280px]">
        <div className="space-y-6 p-6">
          <div className="flex items-center gap-3">
            <Avatar name={linked.trainer_name} size={44} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-fg">{linked.trainer_name}</p>
              <p className="truncate text-[13px] text-fg-subtle">
                {linked.public_enabled && linked.public_slug
                  ? <Link href={`/club/${linked.public_slug}`} className="hover:text-fg-soft">{linked.club_name}</Link>
                  : linked.club_name}
                {linked.trainer_id && <> · ID <span className="num">{linked.trainer_id}</span></>}
              </p>
            </div>
            {!linked.is_active && <Chip className="ml-auto">No longer seen in club</Chip>}
          </div>

          {stats ? (
            <>
              <div>
                <p className={`num font-display text-[44px] font-semibold leading-none tracking-[-0.03em] ${ahead ? 'text-good' : 'text-warn'}`}>
                  {formatDelta(stats.surplus)}
                </p>
                <p className="mt-2 text-[15px] font-medium text-fg">{ahead ? 'ahead of quota' : 'behind quota'}</p>
                <p className="mt-1.5 max-w-[60ch] text-[13px] leading-relaxed text-fg-muted text-pretty">
                  {coaching(stats, perDayQuota)}
                </p>
              </div>

              <MonthProgress fans={stats.fans} target={stats.target} expectedNow={stats.expectedNow} daysLeft={stats.daysLeft} />
            </>
          ) : (
            <p className="text-[13px] text-fg-muted">
              No quota data for this month yet. It appears after your club&apos;s next daily check.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 border-t border-line bg-surface-2/40 lg:grid-cols-1 lg:border-t-0 lg:border-l">
          <div className="p-6">
            <p className="text-[13px] text-fg-muted">Place in club</p>
            <p className="num mt-1 font-display text-[40px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {standing ? `#${standing.pos}` : '–'}
            </p>
            <p className="mt-1.5 text-xs text-fg-subtle">{standing ? `of ${standing.total} by fans this month` : 'Shows after the next check'}</p>
          </div>
          <div className="border-l border-line p-6 lg:border-t lg:border-l-0">
            <p className="text-[13px] text-fg-muted">On-track streak</p>
            <p className="mt-1 flex items-center gap-2 font-display text-[40px] font-semibold leading-none tracking-[-0.03em] text-fg">
              <span className="num">{streak}</span>
              {streak >= 3 && <Flame size={26} strokeWidth={1.75} className="text-brand" aria-hidden />}
            </p>
            <p className="mt-1.5 text-xs text-fg-subtle">
              {streak === 0 ? 'Get back on track to start one' : `daily check${streak === 1 ? '' : 's'} in a row at or above quota`}
            </p>
          </div>
        </div>
      </section>

      {stats && (
        <StatStrip>
          <Stat
            label={stats.catchUp ? 'Needed per day to catch up' : 'Daily target'}
            value={formatFans(Math.ceil(stats.catchUp ?? perDayQuota))}
            tone={stats.catchUp ? 'warn' : 'neutral'}
          />
          <Stat
            label="Your recent pace"
            value={stats.pace !== null ? formatFans(Math.round(stats.pace)) : '–'}
            tone={stats.pace === null ? 'neutral' : stats.pace >= (stats.catchUp ?? perDayQuota) ? 'good' : 'warn'}
            hint="per day, last 7 days"
          />
          <Stat
            label="Month-end projection"
            value={stats.projected !== null ? formatFans(Math.round(stats.projected)) : '–'}
            tone={stats.projected === null ? 'neutral' : stats.projected >= stats.target ? 'good' : 'warn'}
            hint={`Target ${formatFans(Math.round(stats.target))}`}
          />
          <Stat label="Days left this month" value={stats.daysLeft} />
        </StatStrip>
      )}

      {history.length >= 2 && (
        <Panel
          title={latest ? monthLabel(latest.date.slice(0, 7)) : 'This month'}
          description="Hover the chart for any day's numbers. The projection assumes you keep your recent pace."
          action={<QuotaChartLegend projected={!!stats?.pace} />}
        >
          <QuotaChart
            data={history.map(h => ({
              date: h.date,
              cumulative: Number(h.cumulative_fans),
              expected: Number(h.expected_fans),
            }))}
            projection={stats?.pace != null ? { pace: stats.pace, perDayQuota } : null}
          />
        </Panel>
      )}

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <NotificationToggles initial={{
          notify_on_bombs: linked.notify_on_bombs,
          notify_on_deficit: linked.notify_on_deficit,
        }} />
        <TransferList transfers={transfers} />
      </div>
    </div>
  )
}

function coaching(
  s: { surplus: number; daysLeft: number; pace: number | null; projected: number | null; target: number; catchUp: number | null; fans: number },
  perDayQuota: number,
) {
  if (s.daysLeft === 0) {
    return s.surplus >= 0 ? 'Last day of the month, and you made quota.' : 'Last day of the month. Every fan today still counts.'
  }
  if (s.surplus < 0) {
    const need = formatFans(Math.ceil(s.catchUp ?? perDayQuota))
    const pace = s.pace !== null ? ` You're averaging ${formatFans(Math.round(s.pace))} a day right now.` : ''
    return `About ${need} a day for the rest of the month gets you back on track.${pace}`
  }
  if (s.projected === null) return 'Keep up the daily runs to stay ahead.'
  if (s.projected >= s.target) {
    return `At this pace you finish around ${formatFans(Math.round(s.projected))}, ${formatFans(Math.round(s.projected - s.target))} over the month target.`
  }
  const need = Math.ceil((s.target - s.fans) / s.daysLeft)
  return `Ahead for now, but this pace finishes around ${formatFans(Math.round(s.projected))}. Around ${formatFans(need)} a day keeps you on target.`
}

function MonthProgress({ fans, target, expectedNow, daysLeft }: { fans: number; target: number; expectedNow: number; daysLeft: number }) {
  const pct = target > 0 ? Math.min(100, (fans / target) * 100) : 0
  const mark = target > 0 ? Math.min(100, (expectedNow / target) * 100) : 0
  const ahead = fans >= expectedNow
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-fg-muted">
          <span className="num font-medium text-fg">{formatFans(fans)}</span> of {formatFans(Math.round(target))} month target
        </span>
        <span className="num text-fg-subtle">{daysLeft} day{daysLeft === 1 ? '' : 's'} left</span>
      </div>
      <div
        className="relative h-3 rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Fans toward month target"
      >
        <div
          className={`h-full rounded-full ${ahead ? 'bg-good' : 'bg-warn'} transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-fg" style={{ left: `calc(${mark}% - 1px)` }} title="Where quota expects you today" />
      </div>
      <p className="mt-2 text-xs text-fg-subtle">The white tick is where quota expects you today.</p>
    </div>
  )
}

function Header() {
  return (
    <PageHeader
      title="My trainer"
      description={<>Your own quota progress, from the trainer you linked with <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-soft">/link_trainer</code>.</>}
    />
  )
}

function TransferList({ transfers }: { transfers: Transfer[] }) {
  if (!transfers.length) return null
  return (
    <Panel title="Transfer requests" flush>
      <ul className="divide-y divide-line border-t border-line">
        {transfers.map(t => (
          <li key={t.request_id} className="flex items-start justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-fg-soft">{t.to_club_name}</p>
              <p className="num text-xs text-fg-subtle">
                {t.status === 'pending'
                  ? `#${t.queue_pos} in queue, requested ${new Date(t.created_at).toLocaleDateString()}`
                  : `Decided ${new Date(t.decided_at ?? t.created_at).toLocaleDateString()}`}
              </p>
              {t.decision_note && <p className="mt-1 text-xs text-fg-muted">{t.decision_note}</p>}
            </div>
            <Chip tone={statusTone[t.status as keyof typeof statusTone] ?? 'neutral'}>
              {statusLabel[t.status] ?? t.status}
            </Chip>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-5 py-3 text-xs text-fg-subtle">
        Withdraw a request with <code className="font-mono text-fg-muted">/my_transfers</code> in Discord.
      </p>
    </Panel>
  )
}
