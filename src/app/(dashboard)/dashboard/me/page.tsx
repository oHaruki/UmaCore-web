import { query, queryOne } from '@/lib/db'
import { auth } from '@/lib/auth'
import { EFFECTIVE_QUOTA_SQL } from '@/lib/quota'
import Link from 'next/link'
import QuotaChart, { QuotaChartLegend, formatFans } from '@/components/QuotaChart'
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

const statusStyle: Record<string, string> = {
  pending:   'bg-violet-500/10 text-violet-300',
  approved:  'bg-emerald-500/10 text-emerald-400',
  rejected:  'bg-red-500/10 text-red-400',
  cancelled: 'bg-zinc-500/10 text-zinc-400',
}
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
      <div className="space-y-5">
        <Header />
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-8 max-w-xl">
          <p className="text-sm font-medium text-white">No trainer linked to your Discord account</p>
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
            Link your trainer in any server where UmaCore tracks your club, then refresh this page.
          </p>
          <div className="mt-5 bg-[#111118] border border-white/5 rounded px-4 py-3 font-mono text-xs text-zinc-300">
            /link_trainer trainer_name:<span className="text-violet-300">YourName</span> club:<span className="text-violet-300">YourClub</span>
          </div>
          <p className="text-[11px] text-zinc-600 mt-3 leading-relaxed">
            The name has to match your in-game trainer name exactly. Your club needs to be tracked by UmaCore already — ask a club leader if it isn&apos;t.
          </p>
        </div>
        <TransferList transfers={transfers} />
      </div>
    )
  }

  const [history, bomb, standing] = await Promise.all([
    // quota_history is cleared at each monthly reset, but keep to the latest month
    // anyway so a club that missed its reset can't blend two months into one chart.
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
    projected: number | null; target: number; catchUp: number | null
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

    stats = { fans, surplus, daysLeft, pace, projected, target, catchUp }
  }

  const daysBehind = latest?.days_behind ?? 0
  const trigger    = linked.bomb_trigger_days

  return (
    <div className="space-y-5">
      <Header />

      {/* Identity */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-white">{linked.trainer_name}</h2>
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-medium ${
            linked.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-zinc-500'
          }`}>
            <span className={`w-1 h-1 rounded-full ${linked.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            {linked.is_active ? 'In club' : 'No longer seen in club'}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400">
            {linked.public_enabled && linked.public_slug
              ? <Link href={`/club/${linked.public_slug}`} className="hover:text-white transition-colors">{linked.club_name}</Link>
              : linked.club_name}
          </p>
          {linked.trainer_id && <p className="text-[10px] text-zinc-600">Trainer ID {linked.trainer_id}</p>}
        </div>
      </div>

      {/* Bomb / risk banner */}
      {bomb ? (
        <div className={`rounded-lg px-5 py-3.5 border ${
          bomb.days_remaining <= 1 ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <p className={`text-sm font-medium ${bomb.days_remaining <= 1 ? 'text-red-300' : 'text-amber-300'}`}>
            💣 Bomb active — {bomb.days_remaining} day{bomb.days_remaining === 1 ? '' : 's'} left
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            It defuses the first daily check you&apos;re back at or above quota.
            {stats && stats.surplus < 0 && bomb.days_remaining > 0 && (
              <> You&apos;re {formatFans(-stats.surplus)} short — about <span className="text-white">{formatFans(Math.ceil(-stats.surplus / bomb.days_remaining))} extra a day</span> on top of quota clears it in time.</>
            )}
          </p>
        </div>
      ) : linked.bombs_enabled && linked.is_active && daysBehind > 0 && daysBehind < trigger ? (
        <div className="rounded-lg px-5 py-3.5 border bg-amber-500/5 border-amber-500/15">
          <p className="text-sm font-medium text-amber-300">
            Behind {daysBehind} day{daysBehind === 1 ? '' : 's'} in a row
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            A bomb starts after {trigger} days in a row. Getting back on track at any daily check resets the count.
          </p>
        </div>
      ) : null}

      {/* Stats */}
      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: stats.surplus >= 0 ? 'Ahead of quota' : 'Behind quota',
              value: (stats.surplus >= 0 ? '+' : '') + formatFans(stats.surplus),
              color: stats.surplus >= 0 ? 'text-emerald-400' : 'text-amber-400',
            },
            {
              label: 'Fans this month',
              value: formatFans(stats.fans),
              sub: standing ? `#${standing.pos} of ${standing.total} in club` : undefined,
            },
            {
              label: stats.catchUp ? 'Need / day to catch up' : 'Daily target',
              value: formatFans(Math.ceil(stats.catchUp ?? perDayQuota)),
              color: stats.catchUp ? 'text-amber-400' : undefined,
              sub: stats.pace !== null ? `Your pace: ${formatFans(Math.round(stats.pace))} / day` : undefined,
            },
            {
              label: 'Month-end projection',
              value: stats.projected !== null ? formatFans(Math.round(stats.projected)) : '—',
              color: stats.projected === null ? undefined
                : stats.projected >= stats.target ? 'text-emerald-400' : 'text-amber-400',
              sub: `Target ${formatFans(Math.round(stats.target))} · ${stats.daysLeft}d left`,
            },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="bg-[#0d0d14] border border-white/5 rounded-lg p-4">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className={`mt-1.5 text-xl font-semibold ${color ?? 'text-white'}`}>{value}</p>
              {sub && <p className="text-[10px] text-zinc-600 mt-1">{sub}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-6 text-xs text-zinc-500">
          No quota data for this month yet — it appears after your club&apos;s next daily check.
        </div>
      )}

      {/* Chart */}
      {history.length >= 2 && (
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p className="text-sm font-medium text-white">This month</p>
            <QuotaChartLegend />
          </div>
          <QuotaChart data={history.map(h => ({
            date: h.date,
            cumulative: Number(h.cumulative_fans),
            expected: Number(h.expected_fans),
          }))} />
          <p className="text-[10px] text-zinc-600 mt-2">
            Projection assumes you keep your recent pace — it&apos;s an estimate, not a promise.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <NotificationToggles initial={{
          notify_on_bombs: linked.notify_on_bombs,
          notify_on_deficit: linked.notify_on_deficit,
        }} />
        <TransferList transfers={transfers} />
      </div>
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-white">My trainer</h1>
      <p className="text-xs text-zinc-500 mt-0.5">
        Your own quota progress, from the trainer you linked with <code className="text-zinc-400">/link_trainer</code>.
      </p>
    </div>
  )
}

function TransferList({ transfers }: { transfers: Transfer[] }) {
  if (!transfers.length) return null
  return (
    <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/5">
        <p className="text-sm font-medium text-white">Transfer requests</p>
      </div>
      <div className="divide-y divide-white/5">
        {transfers.map(t => (
          <div key={t.request_id} className="px-5 py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate">{t.to_club_name}</p>
              <p className="text-[10px] text-zinc-600">
                {t.status === 'pending'
                  ? `#${t.queue_pos} in queue · requested ${new Date(t.created_at).toLocaleDateString()}`
                  : `Decided ${new Date(t.decided_at ?? t.created_at).toLocaleDateString()}`}
              </p>
              {t.decision_note && <p className="text-[10px] text-zinc-500 mt-1">{t.decision_note}</p>}
            </div>
            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${statusStyle[t.status] ?? 'bg-zinc-500/10 text-zinc-400'}`}>
              {statusLabel[t.status] ?? t.status}
            </span>
          </div>
        ))}
      </div>
      <p className="px-5 py-2.5 border-t border-white/5 text-[10px] text-zinc-600">
        Withdraw a request with <code className="text-zinc-500">/my_transfers</code> in Discord.
      </p>
    </div>
  )
}
