import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { EFFECTIVE_QUOTA_SQL } from '@/lib/quota'
import { accessibleClubIds } from '@/lib/guild-check'
import { getActiveClubId } from '@/lib/active-club'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings as SettingsIcon, Trophy, Check, ArrowRight } from 'lucide-react'
import { formatDay, formatDelta, formatFans } from '@/lib/format'
import { monthStart, monthLabel, inMonthSql } from '@/lib/month'
import { PageHeader, Panel, Stat, StatStrip, Chip, SplitMeter, Avatar, EmptyState } from '@/components/dash/ui'
import LineChart from '@/components/dash/LineChart'
import SyncButton from '../reports/SyncButton'
import StandingsTable from './StandingsTable'

type ClubOption = { club_id: string; club_name: string }

type ClubDetail = {
  club_id: string
  club_name: string
  daily_quota: string
  quota_period: string
  is_active: boolean
  bombs_enabled: boolean
  bomb_trigger_days: string
  bomb_countdown_days: string
  active_members: string
  on_track: string
  behind: string
  avg_surplus: string
  latest_rank: string | null
  circle_id: string | null
}

type MemberStanding = {
  member_id: string
  trainer_name: string
  deficit_surplus: string
  cumulative_fans: string
  days_behind: string
  bomb_days: string | null
}

type ComplianceDay = {
  date: string
  total: string
  on_track: string
}

type RankDay = {
  date: string
  club_rank: string
}

type BombStats = {
  active_bombs: string
  resolved_bombs: string
  members_bombed_ever: string
  avg_duration: string | null
}

export default async function ClubOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>
}) {
  const session = await auth()
  const clubIds = session ? await accessibleClubIds(session) : []
  const { clubId: rawClubId } = await searchParams

  const clubs = await query<ClubOption>(`
    SELECT club_id::text, club_name FROM clubs
    WHERE club_id::text = ANY($1::text[])
    ORDER BY club_name
  `, [clubIds]).catch(() => [])

  if (clubs.length === 0) {
    return (
      <div className="panel">
        <EmptyState
          title="No clubs yet"
          body="Add a club from the Overview to see its home page."
          action={<Link href="/dashboard" className="btn btn-secondary">Go to Overview</Link>}
        />
      </div>
    )
  }

  // Prefer the explicit ?clubId, then the active-club cookie, then the first club.
  const cookieId = await getActiveClubId()
  const clubId =
    rawClubId ??
    (cookieId && clubs.some(c => c.club_id === cookieId) ? cookieId : clubs[0].club_id)

  // Everything below is the club's current quota month: the month of its latest daily check.
  const [current] = await query<{ month: string | null; last: string | null }>(`
    SELECT to_char(MAX(date), 'YYYY-MM') AS month, MAX(date)::text AS last
    FROM quota_history WHERE club_id = $1
  `, [clubId]).catch(() => [])
  const month = current?.month ?? null
  const start = month ? monthStart(month) : null

  const [clubRows, members, compliance, rankHistory, bombStatRows] = await Promise.all([
    query<ClubDetail>(`
      SELECT c.club_id::text, c.club_name, ${EFFECTIVE_QUOTA_SQL}::text AS daily_quota, c.quota_period,
        c.is_active, c.bombs_enabled, c.circle_id,
        c.bomb_trigger_days::text, c.bomb_countdown_days::text,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus IS NOT NULL)::text AS active_members,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus >= 0)::text AS on_track,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus < 0)::text AS behind,
        ROUND(AVG(lat.deficit_surplus) FILTER (WHERE m.is_active))::text AS avg_surplus,
        (SELECT club_rank::text FROM club_rank_history WHERE club_id = c.club_id ORDER BY date DESC LIMIT 1) AS latest_rank
      FROM clubs c
      LEFT JOIN members m ON m.club_id = c.club_id
      LEFT JOIN LATERAL (
        SELECT deficit_surplus FROM quota_history
        WHERE member_id = m.member_id AND club_id = c.club_id AND ${inMonthSql('date', '$3')}
        ORDER BY date DESC LIMIT 1
      ) lat ON true
      WHERE c.club_id = $1 AND c.club_id::text = ANY($2::text[])
      GROUP BY c.club_id
    `, [clubId, clubIds, start]).catch(() => []),

    query<MemberStanding>(`
      SELECT m.member_id::text, m.trainer_name,
        lat.deficit_surplus::text, lat.cumulative_fans::text, lat.days_behind::text,
        (SELECT b.days_remaining::text FROM bombs b
          WHERE b.member_id = m.member_id AND b.is_active
          ORDER BY b.activation_date DESC LIMIT 1) AS bomb_days
      FROM members m
      JOIN LATERAL (
        SELECT deficit_surplus, cumulative_fans, days_behind
        FROM quota_history
        WHERE member_id = m.member_id AND club_id = $1 AND ${inMonthSql('date', '$2')}
        ORDER BY date DESC LIMIT 1
      ) lat ON true
      WHERE m.club_id = $1 AND m.is_active = true
      ORDER BY lat.deficit_surplus DESC
    `, [clubId, start]).catch(() => []),

    query<ComplianceDay>(`
      SELECT qh.date::text,
        COUNT(DISTINCT qh.member_id)::text AS total,
        COUNT(DISTINCT qh.member_id) FILTER (WHERE qh.deficit_surplus >= 0)::text AS on_track
      FROM quota_history qh
      JOIN members m ON m.member_id = qh.member_id AND m.is_active = true
      WHERE qh.club_id = $1 AND ${inMonthSql('qh.date', '$2')}
      GROUP BY qh.date ORDER BY qh.date ASC
    `, [clubId, start]).catch(() => []),

    query<RankDay>(`
      SELECT date::text, club_rank::text
      FROM club_rank_history
      WHERE club_id = $1 AND ${inMonthSql('date', '$2')}
      ORDER BY date ASC
    `, [clubId, start]).catch(() => []),

    query<BombStats>(`
      SELECT
        COUNT(*) FILTER (WHERE is_active)::text AS active_bombs,
        COUNT(*) FILTER (WHERE NOT is_active)::text AS resolved_bombs,
        COUNT(DISTINCT member_id)::text AS members_bombed_ever,
        ROUND(AVG(CASE WHEN NOT is_active AND deactivation_date IS NOT NULL
          THEN (deactivation_date::date - activation_date::date)::numeric END))::text AS avg_duration
      FROM bombs WHERE club_id::text = $1
    `, [clubId]).catch(() => []),
  ])

  const club = clubRows[0]
  if (!club) redirect('/dashboard/clubs')

  const bombStats = bombStatRows[0] ?? {
    active_bombs: '0', resolved_bombs: '0', members_bombed_ever: '0', avg_duration: null,
  }

  const totalActive = Number(club.active_members)
  const onTrack = Number(club.on_track)
  const behind = Number(club.behind)
  const compliancePct = totalActive > 0 ? Math.round((onTrack / totalActive) * 100) : 0
  const avgSurplus = Number(club.avg_surplus ?? 0)
  const activeBombs = Number(bombStats.active_bombs)

  const rows = members.map(m => ({
    member_id: m.member_id,
    trainer_name: m.trainer_name,
    surplus: Number(m.deficit_surplus),
    fans: Number(m.cumulative_fans),
    days_behind: Number(m.days_behind),
    bomb_days: m.bomb_days === null ? null : Number(m.bomb_days),
  }))
  const topPerformers = rows.slice(0, 3)
  const struggling = [...rows].reverse().filter(m => m.surplus < 0).slice(0, 5)

  const compliancePoints = compliance.map(d =>
    Number(d.total) > 0 ? (Number(d.on_track) / Number(d.total)) * 100 : 0
  )
  const complianceDelta = compliancePoints.length >= 2
    ? Math.round(compliancePoints[compliancePoints.length - 1] - compliancePoints[0])
    : null

  const monthName = month ? monthLabel(month) : null
  const ranks = cleanRanks(rankHistory)
  const rankDelta = ranks.length >= 2
    ? Number(ranks[0].club_rank) - Number(ranks[ranks.length - 1].club_rank)
    : null

  return (
    <div className="rise space-y-6">
      <PageHeader
        title={club.club_name}
        meta={
          <>
            <Chip tone={club.is_active ? 'good' : 'neutral'}>{club.is_active ? 'Active' : 'Inactive'}</Chip>
            {monthName && (
              <Chip tone="brand" title={current?.last ? `Latest daily check ${formatDay(current.last)}` : undefined}>
                {monthName}{current?.last ? `, as of ${formatDay(current.last)}` : ''}
              </Chip>
            )}
            <Chip className="num">{formatFans(Number(club.daily_quota))} fans per {periodWord(club.quota_period)}</Chip>
            {club.bombs_enabled
              ? <Chip>Bomb after {club.bomb_trigger_days} days behind, {club.bomb_countdown_days} days to recover</Chip>
              : <Chip>Bombs off</Chip>}
          </>
        }
        actions={
          <>
            <SyncButton clubId={club.club_id} hasCircleId={!!club.circle_id} />
            <Link href="/dashboard/settings" className="btn btn-secondary">
              <SettingsIcon size={15} strokeWidth={1.75} />
              Settings
            </Link>
          </>
        }
      />

      <StatStrip>
        <Stat label="Active members" value={club.active_members} />
        <Stat
          label="On track"
          value={`${compliancePct}%`}
          tone={totalActive ? (compliancePct >= 80 ? 'good' : 'warn') : 'neutral'}
          hint={`${onTrack} of ${totalActive}`}
        />
        <Stat label="Average surplus" value={formatDelta(avgSurplus)} tone={avgSurplus >= 0 ? 'good' : 'warn'} />
        <Stat label="Club rank" value={club.latest_rank ? `#${Number(club.latest_rank).toLocaleString('en-US')}` : '–'} />
        <Stat label="Active bombs" value={activeBombs} tone={activeBombs > 0 ? 'bad' : 'neutral'} />
      </StatStrip>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Members on track"
          description={monthName ? `Share at or above quota at each check in ${monthName}` : 'Share at or above quota at each check'}
          action={complianceDelta !== null && (
            <Chip tone={complianceDelta >= 0 ? 'good' : 'warn'} className="num">
              {complianceDelta >= 0 ? '+' : ''}{complianceDelta} pts
            </Chip>
          )}
        >
          <SplitMeter good={onTrack} bad={behind} className="mb-4" />
          {compliance.length >= 2 ? (
            <LineChart
              labels={compliance.map(d => d.date)}
              series={[{ key: 'pct', label: 'On track', values: compliancePoints, color: 'var(--uc-good)', area: true }]}
              format="percent"
              clamp={[0, 100]}
              height={210}
            />
          ) : (
            <EmptyState title="Not enough checks yet" body="The chart fills in once the month has a couple of daily checks." className="py-10" />
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Club rank"
          description={`${monthName ?? 'This month'}. Higher on the chart is better.`}
          action={rankDelta !== null && rankDelta !== 0 && (
            <Chip tone={rankDelta > 0 ? 'good' : 'warn'} className="num">
              {rankDelta > 0 ? `Up ${rankDelta}` : `Down ${-rankDelta}`}
            </Chip>
          )}
        >
          {ranks.length >= 2 ? (
            <LineChart
              labels={ranks.map(r => r.date)}
              series={[{ key: 'rank', label: 'Rank', values: ranks.map(r => Number(r.club_rank)), color: 'var(--uc-brand)' }]}
              format="rank"
              invert
              height={226}
            />
          ) : (
            <EmptyState title="Not enough rank data yet" body="Rank shows up here once the bot has recorded it a few times this month." className="py-10" />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={monthName ? `Member standings, ${monthName}` : 'Member standings'}
          description={`Fans and surplus for this month${current?.last ? ` as of ${formatDay(current.last)}` : ''}. Click a column to sort, or a row to open the member.`}
          action={<Link href="/dashboard/quota" className="link text-[13px]">Earlier months</Link>}
          flush
        >
          <StandingsTable rows={rows} />
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Needs attention"
            action={<Link href="/dashboard/reports" className="link text-[13px]">Daily report</Link>}
            flush
          >
            {struggling.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {struggling.map(m => (
                  <li key={m.member_id}>
                    <Link
                      href={`/dashboard/members/${m.member_id}`}
                      className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2/60"
                    >
                      <Avatar name={m.trainer_name} size={26} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-fg-soft">{m.trainer_name}</span>
                      {m.bomb_days !== null
                        ? <Chip tone={m.bomb_days <= 1 ? 'bad' : 'warn'}>💣 {m.bomb_days}d</Chip>
                        : m.days_behind > 0 && <span className="num text-xs text-fg-subtle">{m.days_behind}d behind</span>}
                      <span className="num w-14 text-right text-[13px] font-medium text-warn">{formatFans(m.surplus)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 border-t border-line px-5 py-4">
                <span className="grid size-8 place-items-center rounded-lg bg-good/12 text-good">
                  <Check size={16} strokeWidth={2} />
                </span>
                <p className="text-[13px] text-fg-muted">Nobody is behind quota right now.</p>
              </div>
            )}
          </Panel>

          {topPerformers.length > 0 && (
            <Panel title="Top performers" flush>
              <ol className="divide-y divide-line border-t border-line">
                {topPerformers.map((m, i) => (
                  <li key={m.member_id}>
                    <Link
                      href={`/dashboard/members/${m.member_id}`}
                      className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2/60"
                    >
                      <span
                        className={`grid size-6 place-items-center rounded-md text-[11px] font-semibold ${
                          i === 0 ? 'bg-brand/16 text-brand' : 'bg-surface-3 text-fg-muted'
                        }`}
                      >
                        {i === 0 ? <Trophy size={13} strokeWidth={2} /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-fg-soft">{m.trainer_name}</span>
                      <span className="num text-[13px] font-medium text-good">{formatDelta(m.surplus)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          <Panel
            title="Bombs"
            action={activeBombs > 0 && (
              <Link href="/dashboard/bombs" className="link inline-flex items-center gap-1 text-[13px]">
                View active <ArrowRight size={13} strokeWidth={1.75} />
              </Link>
            )}
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              {[
                { label: 'Active', value: bombStats.active_bombs, tone: activeBombs > 0 ? 'text-bad' : undefined },
                { label: 'Resolved', value: bombStats.resolved_bombs },
                { label: 'Members affected', value: bombStats.members_bombed_ever },
                { label: 'Average to resolve', value: bombStats.avg_duration ? `${bombStats.avg_duration} days` : '–' },
              ].map(({ label, value, tone }) => (
                <div key={label}>
                  <dt className="text-xs text-fg-subtle">{label}</dt>
                  <dd className={`num mt-0.5 font-display text-xl font-semibold ${tone ?? 'text-fg'}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}

/** Drop rank spikes (missed scrapes report huge ranks) so the chart shows the real trend. */
function cleanRanks(data: RankDay[]) {
  const sorted = data.map(d => Number(d.club_rank)).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1
  return data.filter(d => Number(d.club_rank) <= median * 5)
}

function periodWord(p: string) {
  return p === 'weekly' ? 'week' : p === 'biweekly' || p === 'bi-weekly' ? '2 weeks' : 'day'
}
