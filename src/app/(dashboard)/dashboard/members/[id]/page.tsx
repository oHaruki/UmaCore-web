import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { ownsClub } from '@/lib/guild-check'
import { notFound, forbidden } from 'next/navigation'
import MemberEditPanel from './MemberEditPanel'
import QuotaChart, { QuotaChartLegend } from '@/components/QuotaChart'
import { formatDay, formatDelta, formatFans } from '@/lib/format'
import { monthLabel } from '@/lib/month'
import { PageHeader, Panel, Stat, StatStrip, Chip, Avatar, EmptyState } from '@/components/dash/ui'
import { MemberToggle } from '../MemberActions'

type Member = {
  member_id: string
  trainer_name: string
  trainer_id: string
  club_name: string
  club_id: string
  is_active: boolean
  manually_deactivated: boolean
  join_date: string | null
  last_seen: string | null
  daily_quota: string
  quota_period: string
}

type UserLink = {
  discord_user_id: string
  notify_on_bombs: boolean
  notify_on_deficit: boolean
}

type HistoryEntry = {
  date: string
  cumulative_fans: string
  expected_fans: string
  deficit_surplus: string
  days_behind: string
}

type Bomb = {
  bomb_id: string
  days_remaining: number
  activation_date: string
  is_active: boolean
  deactivation_date: string | null
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()

  const [member] = await query<Member>(`
    SELECT m.member_id, m.trainer_name, m.trainer_id, m.is_active, m.manually_deactivated,
           m.join_date::text, m.last_seen::text, c.club_name, c.club_id,
           c.daily_quota::text, c.quota_period
    FROM members m JOIN clubs c ON c.club_id = m.club_id
    WHERE m.member_id = $1
  `, [id]).catch(() => [])

  if (!member) notFound()
  if (!(await ownsClub(session!, member.club_id))) forbidden()

  const [userLink] = await query<UserLink>(`
    SELECT discord_user_id::text, notify_on_bombs, notify_on_deficit
    FROM user_links WHERE member_id = $1
  `, [id]).catch(() => [])

  const history = await query<HistoryEntry>(`
    SELECT date::text, cumulative_fans::text, expected_fans::text,
           deficit_surplus::text, days_behind::text
    FROM quota_history
    WHERE member_id = $1
    ORDER BY date ASC
  `, [id]).catch(() => [])

  const bombs = await query<Bomb>(`
    SELECT bomb_id, days_remaining, activation_date::text, is_active, deactivation_date::text
    FROM bombs WHERE member_id = $1
    ORDER BY is_active DESC, activation_date DESC
  `, [id]).catch(() => [])

  const activeBomb = bombs.find(b => b.is_active)

  // Quota runs per calendar month (fans restart on the 1st), so the stats and chart
  // cover the month of this member's latest check.
  const latest       = history[history.length - 1]
  const month        = latest?.date.slice(0, 7) ?? null
  const monthHistory = month ? history.filter(h => h.date.startsWith(month)) : []
  const monthName    = month ? monthLabel(month) : null
  const total        = monthHistory.length
  const onTrack      = monthHistory.filter(h => Number(h.deficit_surplus) >= 0).length
  const avgSurplus   = total > 0
    ? Math.round(monthHistory.reduce((s, h) => s + Number(h.deficit_surplus), 0) / total)
    : 0
  const latestSurplus = latest ? Number(latest.deficit_surplus) : null

  // Catch-up: what per day recovers the deficit by the end of that month.
  // 'biweekly' is the canonical value the bot writes; 'bi-weekly' is tolerated so
  // clubs saved by an older dashboard build still render correctly before migration.
  const periodDays  = { daily: 1, weekly: 7, biweekly: 14, 'bi-weekly': 14 }[member.quota_period] ?? 1
  const perDayQuota = Number(member.daily_quota) / periodDays
  const currentDeficit = latest ? Math.max(0, -Number(latest.deficit_surplus)) : 0
  let daysRemaining = 1
  if (latest) {
    const [y, m, d] = latest.date.split('-').map(Number)
    daysRemaining = Math.max(1, new Date(y, m, 0).getDate() - d)
  }
  const catchUpPerDay = currentDeficit > 0
    ? Math.ceil(perDayQuota + currentDeficit / daysRemaining)
    : null

  // Newest month first, each with its own heading row in the history table.
  const byMonth = Object.entries(
    history.reduce<Record<string, HistoryEntry[]>>((acc, h) => {
      (acc[h.date.slice(0, 7)] ??= []).push(h)
      return acc
    }, {})
  ).sort(([a], [b]) => b.localeCompare(a))

  return (
    <div className="rise space-y-6">
      <PageHeader
        back={{ href: '/dashboard/members', label: 'Members' }}
        title={
          <span className="flex items-center gap-3.5">
            <Avatar name={member.trainer_name} size={44} />
            <span className="min-w-0 truncate">{member.trainer_name}</span>
          </span>
        }
        meta={
          <>
            <Chip tone={member.is_active ? 'good' : 'neutral'}>{member.is_active ? 'Active' : 'Inactive'}</Chip>
            {activeBomb && (
              <Chip tone={activeBomb.days_remaining <= 1 ? 'bad' : 'warn'}>💣 {activeBomb.days_remaining}d left</Chip>
            )}
            <Chip className="num">ID {member.trainer_id}</Chip>
            {userLink ? (
              <Chip tone="info" title={
                userLink.notify_on_bombs || userLink.notify_on_deficit
                  ? `DMs on ${[userLink.notify_on_bombs && 'bombs', userLink.notify_on_deficit && 'deficit'].filter(Boolean).join(' and ')}`
                  : 'DMs off'
              }>
                Discord linked
              </Chip>
            ) : (
              <Chip>No Discord link</Chip>
            )}
          </>
        }
        actions={<MemberToggle memberId={member.member_id} isActive={member.is_active} name={member.trainer_name} />}
      />

      <StatStrip>
        <Stat
          label="Surplus"
          value={latestSurplus !== null ? formatDelta(latestSurplus) : '–'}
          tone={latestSurplus === null ? 'neutral' : latestSurplus >= 0 ? 'good' : 'warn'}
          hint={latest ? `as of ${formatDay(latest.date)}` : undefined}
        />
        <Stat
          label={monthName ? `Fans in ${monthLabel(month!, { month: 'long' })}` : 'Fans this month'}
          value={latest ? formatFans(Number(latest.cumulative_fans)) : '–'}
        />
        <Stat
          label={catchUpPerDay ? 'Needed per day to recover' : 'Daily target'}
          value={catchUpPerDay ? formatFans(catchUpPerDay) : formatFans(Math.ceil(perDayQuota))}
          tone={catchUpPerDay ? 'warn' : 'neutral'}
        />
        <Stat
          label="Checks on track"
          value={total ? `${Math.round((onTrack / total) * 100)}%` : '–'}
          hint={total ? `${onTrack} of ${total} this month` : undefined}
          tone={total ? (onTrack === total ? 'good' : 'neutral') : 'neutral'}
        />
        <Stat label="Average surplus" value={formatDelta(avgSurplus)} tone={avgSurplus >= 0 ? 'good' : 'warn'} hint="this month" />
      </StatStrip>

      {monthHistory.length >= 2 && (
        <Panel
          title="Fan progression"
          description={monthName ?? undefined}
          action={<QuotaChartLegend />}
        >
          <QuotaChart data={monthHistory.map(h => ({
            date: h.date,
            cumulative: Number(h.cumulative_fans),
            expected: Number(h.expected_fans),
          }))} />
        </Panel>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Quota history"
          description={`${history.length} daily check${history.length === 1 ? '' : 's'} across ${byMonth.length} month${byMonth.length === 1 ? '' : 's'}`}
          flush
        >
          {history.length ? (
            <div className="max-h-[480px] overflow-auto border-t border-line">
              <table className="table-ui">
                <thead className="sticky top-0 z-[1]">
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Fans</th>
                    <th className="hidden text-right sm:table-cell">Expected</th>
                    <th className="text-right">Surplus</th>
                    <th className="text-right">Days behind</th>
                  </tr>
                </thead>
                {byMonth.map(([m, rows]) => (
                <tbody key={m}>
                  <tr className="bg-surface-2/70 hover:bg-surface-2/70">
                    <td colSpan={5} className="py-2 text-xs font-medium text-fg-muted">
                      {monthLabel(m)}
                      <span className="num ml-2 font-normal text-fg-subtle">
                        {rows.filter(r => Number(r.deficit_surplus) >= 0).length} of {rows.length} on track
                      </span>
                    </td>
                  </tr>
                  {[...rows].reverse().map(h => {
                    const val = Number(h.deficit_surplus)
                    return (
                      <tr key={h.date}>
                        <td className="num text-fg-muted">{formatDay(h.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                        <td className="num text-right text-fg-soft">{formatFans(Number(h.cumulative_fans))}</td>
                        <td className="num hidden text-right text-fg-subtle sm:table-cell">{formatFans(Number(h.expected_fans))}</td>
                        <td className={`num text-right font-medium ${val >= 0 ? 'text-good' : 'text-warn'}`}>{formatDelta(val)}</td>
                        <td className={`num text-right ${Number(h.days_behind) > 0 ? 'text-warn' : 'text-fg-subtle'}`}>
                          {Number(h.days_behind) > 0 ? `${h.days_behind}d` : '–'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                ))}
              </table>
            </div>
          ) : (
            <EmptyState title="No history yet" body="Rows appear after this member's first daily check." className="border-t border-line" />
          )}
        </Panel>

        <div className="space-y-4">
          <MemberEditPanel
            memberId={member.member_id}
            initialJoinDate={member.join_date ?? ''}
            initialTrainerName={member.trainer_name}
            lastSeen={member.last_seen}
            manuallyDeactivated={member.manually_deactivated}
          />

          <Panel title="Bomb history" flush>
            {bombs.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {bombs.map(b => (
                  <li key={b.bomb_id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="num text-[13px] text-fg-soft">
                        {new Date(b.activation_date).toLocaleDateString()}
                        {b.deactivation_date && <span className="text-fg-subtle"> to {new Date(b.deactivation_date).toLocaleDateString()}</span>}
                      </p>
                      <p className="text-xs text-fg-subtle">{b.is_active ? `${b.days_remaining} days remaining` : 'Defused'}</p>
                    </div>
                    <Chip tone={b.is_active ? (b.days_remaining <= 1 ? 'bad' : 'warn') : 'neutral'}>
                      {b.is_active ? 'Active' : 'Resolved'}
                    </Chip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-line px-5 py-4 text-[13px] text-fg-subtle">No bombs so far.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
