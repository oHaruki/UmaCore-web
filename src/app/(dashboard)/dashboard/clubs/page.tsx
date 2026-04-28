import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ClubSelector from './ClubSelector'

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
}

type MemberStanding = {
  member_id: string
  trainer_name: string
  deficit_surplus: string
  cumulative_fans: string
  days_behind: string
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
  const guildIds = session?.adminGuildIds ?? []
  const { clubId: rawClubId } = await searchParams

  const clubs = await query<ClubOption>(`
    SELECT club_id::text, club_name FROM clubs
    WHERE guild_id::text = ANY($1::text[])
    ORDER BY club_name
  `, [guildIds]).catch(() => [])

  if (clubs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-zinc-500">No clubs found.</p>
      </div>
    )
  }

  const clubId = rawClubId ?? clubs[0].club_id

  const [clubRows, members, compliance, rankHistory, bombStatRows] = await Promise.all([
    query<ClubDetail>(`
      SELECT c.club_id::text, c.club_name, c.daily_quota::text, c.quota_period,
        c.is_active, c.bombs_enabled,
        c.bomb_trigger_days::text, c.bomb_countdown_days::text,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus IS NOT NULL)::text AS active_members,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus >= 0)::text AS on_track,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus < 0)::text AS behind,
        ROUND(AVG(lat.deficit_surplus) FILTER (WHERE m.is_active))::text AS avg_surplus,
        (SELECT club_rank::text FROM club_rank_history WHERE club_id = c.club_id ORDER BY date DESC LIMIT 1) AS latest_rank
      FROM clubs c
      LEFT JOIN members m ON m.club_id = c.club_id
      LEFT JOIN LATERAL (
        SELECT deficit_surplus FROM quota_history WHERE member_id = m.member_id ORDER BY date DESC LIMIT 1
      ) lat ON true
      WHERE c.club_id = $1 AND c.guild_id::text = ANY($2::text[])
      GROUP BY c.club_id
    `, [clubId, guildIds]).catch(() => []),

    query<MemberStanding>(`
      SELECT m.member_id::text, m.trainer_name,
        lat.deficit_surplus::text, lat.cumulative_fans::text, lat.days_behind::text
      FROM members m
      JOIN LATERAL (
        SELECT deficit_surplus, cumulative_fans, days_behind
        FROM quota_history WHERE member_id = m.member_id
        ORDER BY date DESC LIMIT 1
      ) lat ON true
      WHERE m.club_id = $1 AND m.is_active = true
      ORDER BY lat.deficit_surplus DESC
    `, [clubId]).catch(() => []),

    query<ComplianceDay>(`
      SELECT qh.date::text,
        COUNT(DISTINCT qh.member_id)::text AS total,
        COUNT(DISTINCT qh.member_id) FILTER (WHERE qh.deficit_surplus >= 0)::text AS on_track
      FROM quota_history qh
      JOIN members m ON m.member_id = qh.member_id AND m.is_active = true
      WHERE qh.club_id = $1 AND qh.date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY qh.date ORDER BY qh.date ASC
    `, [clubId]).catch(() => []),

    query<RankDay>(`
      SELECT date::text, club_rank::text
      FROM club_rank_history
      WHERE club_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY date ASC
    `, [clubId]).catch(() => []),

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
  const compliancePct = totalActive > 0 ? Math.round((onTrack / totalActive) * 100) : 0
  const avgSurplus = Number(club.avg_surplus ?? 0)

  const topPerformers = members.slice(0, 3)
  const struggling = [...members].reverse().filter(m => Number(m.deficit_surplus) < 0).slice(0, 3)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Club Overview</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Detailed stats and member standings</p>
        </div>
        <ClubSelector clubs={clubs} selected={clubId} />
      </div>

      {/* Club identity bar */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-lg px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${club.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          <p className="text-sm font-semibold text-white">{club.club_name}</p>
          <span className="text-xs text-zinc-600 capitalize">{club.quota_period} quota</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-zinc-500">
          <span>{formatFans(Number(club.daily_quota))} fans / day</span>
          {club.bombs_enabled && (
            <span>Bomb trigger: {club.bomb_trigger_days}d behind · {club.bomb_countdown_days}d to resolve</span>
          )}
          {club.latest_rank && <span>Current rank #{club.latest_rank}</span>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Active members', value: club.active_members },
          { label: 'On track', value: `${club.on_track} (${compliancePct}%)`, color: 'text-emerald-400' },
          { label: 'Behind quota', value: club.behind, color: Number(club.behind) > 0 ? 'text-amber-400' : undefined },
          {
            label: 'Avg surplus',
            value: (avgSurplus >= 0 ? '+' : '') + formatFans(avgSurplus),
            color: avgSurplus >= 0 ? 'text-emerald-400' : 'text-amber-400',
          },
          { label: 'Current rank', value: club.latest_rank ? `#${club.latest_rank}` : '—' },
          {
            label: 'Active bombs',
            value: bombStats.active_bombs,
            color: Number(bombStats.active_bombs) > 0 ? 'text-red-400' : undefined,
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0d0d14] border border-white/5 rounded-lg p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`mt-1.5 text-xl font-semibold ${color ?? 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-[#0d0d14] border border-white/5 rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <p className="text-sm font-medium text-white">Quota compliance (30d)</p>
            <span className="text-xs text-zinc-500">% of active members on track per day</span>
          </div>
          <div className="flex-1 min-h-[180px]">
            {compliance.length >= 2 ? (
              <ComplianceChart data={compliance} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-zinc-600">Not enough data yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-2 bg-[#0d0d14] border border-white/5 rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <p className="text-sm font-medium text-white">Club rank (30d)</p>
            <span className="text-xs text-zinc-500">Lower is better</span>
          </div>
          <div className="flex-1 min-h-[180px]">
            {rankHistory.length >= 2 ? (
              <RankChart data={rankHistory} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-zinc-600">No rank data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Member standings + side panels */}
      <div className="grid grid-cols-5 gap-4">
        {/* Full standings table */}
        <div className="col-span-3 bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
            <p className="text-sm font-medium text-white">Member standings</p>
            <span className="text-xs text-zinc-600">{members.length} active</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs text-zinc-500 font-normal w-8">#</th>
                <th className="px-4 py-3 text-left text-xs text-zinc-500 font-normal">Trainer</th>
                <th className="px-4 py-3 text-left text-xs text-zinc-500 font-normal">Surplus / Deficit</th>
                <th className="px-4 py-3 text-left text-xs text-zinc-500 font-normal">Fans</th>
                <th className="px-4 py-3 text-left text-xs text-zinc-500 font-normal">Days behind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {members.map((m, i) => {
                const val = Number(m.deficit_surplus)
                return (
                  <tr key={m.member_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-600">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/members/${m.member_id}`}
                        className="text-xs font-medium text-zinc-200 hover:text-white transition-colors"
                      >
                        {m.trainer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${val >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {val >= 0 ? '+' : ''}{formatFans(val)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{formatFans(Number(m.cumulative_fans))}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${Number(m.days_behind) > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                        {m.days_behind}d
                      </span>
                    </td>
                  </tr>
                )
              })}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-xs text-zinc-600 text-center">
                    No active members with quota history
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Side panels */}
        <div className="col-span-2 space-y-3">
          {/* Bomb stats */}
          <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-5">
            <p className="text-sm font-medium text-white mb-4">Bomb statistics</p>
            <div className="grid grid-cols-2 gap-y-4 gap-x-3">
              {[
                { label: 'Active', value: bombStats.active_bombs, color: Number(bombStats.active_bombs) > 0 ? 'text-red-400' : 'text-white' },
                { label: 'Resolved', value: bombStats.resolved_bombs },
                { label: 'Members affected', value: bombStats.members_bombed_ever },
                { label: 'Avg resolution', value: bombStats.avg_duration ? `${bombStats.avg_duration}d` : '—' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className="text-[10px] text-zinc-600 mb-0.5">{label}</p>
                  <p className={`text-lg font-semibold ${color ?? 'text-white'}`}>{value}</p>
                </div>
              ))}
            </div>
            {Number(bombStats.active_bombs) > 0 && (
              <Link
                href={`/dashboard/bombs?clubId=${clubId}`}
                className="mt-4 block text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                View active bombs →
              </Link>
            )}
          </div>

          {/* Top performers */}
          {topPerformers.length > 0 && (
            <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/5">
                <p className="text-sm font-medium text-white">Top performers</p>
              </div>
              <div className="divide-y divide-white/5">
                {topPerformers.map((m, i) => (
                  <div key={m.member_id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] text-zinc-600 w-4 shrink-0">{i + 1}</span>
                      <Link
                        href={`/dashboard/members/${m.member_id}`}
                        className="text-xs text-zinc-300 hover:text-white transition-colors truncate"
                      >
                        {m.trainer_name}
                      </Link>
                    </div>
                    <span className="text-xs font-medium text-emerald-400 shrink-0 ml-2">
                      +{formatFans(Number(m.deficit_surplus))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Struggling members */}
          {struggling.length > 0 && (
            <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/5">
                <p className="text-sm font-medium text-white">Needs attention</p>
              </div>
              <div className="divide-y divide-white/5">
                {struggling.map(m => (
                  <div key={m.member_id} className="px-5 py-3 flex items-center justify-between">
                    <Link
                      href={`/dashboard/members/${m.member_id}`}
                      className="text-xs text-zinc-300 hover:text-white transition-colors truncate"
                    >
                      {m.trainer_name}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {Number(m.days_behind) > 0 && (
                        <span className="text-[10px] text-zinc-600">{m.days_behind}d behind</span>
                      )}
                      <span className="text-xs font-medium text-amber-400">
                        {formatFans(Number(m.deficit_surplus))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ComplianceChart({ data }: { data: ComplianceDay[] }) {
  const W = 600, H = 200
  const pad = { top: 10, right: 8, bottom: 26, left: 38 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  const percents = data.map(d =>
    Number(d.total) > 0 ? (Number(d.on_track) / Number(d.total)) * 100 : 0
  )

  // Auto-scale Y to actual data range with 5% padding, snapped to nearest 5
  const rawMin = Math.min(...percents)
  const rawMax = Math.max(...percents)
  const yMin = Math.max(0, Math.floor((rawMin - 5) / 5) * 5)
  const yMax = Math.min(100, Math.ceil((rawMax + 5) / 5) * 5)
  const yRange = yMax - yMin || 1

  const xOf = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * plotW
  const yOf = (pct: number) => pad.top + plotH - ((pct - yMin) / yRange) * plotH

  const linePoints = percents.map((p, i) => `${xOf(i)},${yOf(p)}`).join(' ')
  const areaPoints = `${pad.left},${pad.top + plotH} ${linePoints} ${xOf(data.length - 1)},${pad.top + plotH}`

  // Generate ~4 Y ticks spaced evenly across the actual range
  const tickStep = Math.ceil((yMax - yMin) / 4 / 5) * 5 || 5
  const yTicks: number[] = []
  for (let t = yMin; t <= yMax; t += tickStep) yTicks.push(t)
  if (yTicks[yTicks.length - 1] !== yMax) yTicks.push(yMax)

  const xStep = Math.max(1, Math.floor(data.length / 6))
  const lastIdx = data.length - 1
  const prevRegular = Math.floor(lastIdx / xStep) * xStep
  const xLabelIdxs = data.map((_, i) => i).filter(i =>
    i % xStep === 0 || (i === lastIdx && lastIdx !== prevRegular && (lastIdx - prevRegular) * 2 > xStep)
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {yTicks.map(pct => (
        <g key={pct}>
          <line x1={pad.left} y1={yOf(pct)} x2={W - pad.right} y2={yOf(pct)} stroke="#ffffff08" strokeWidth="1" />
          <text x={pad.left - 4} y={yOf(pct) + 4} textAnchor="end" fontSize="9" fill="#52525b">{pct}%</text>
        </g>
      ))}

      <polygon points={areaPoints} fill="#10b98115" />
      <polyline points={linePoints} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />

      {data.length > 0 && (
        <circle cx={xOf(data.length - 1)} cy={yOf(percents[percents.length - 1])} r="3" fill="#10b981" />
      )}

      {xLabelIdxs.map(i => (
        <text key={i} x={xOf(i)} y={H - 5} textAnchor="middle" fontSize="9" fill="#52525b">
          {new Date(data[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}
    </svg>
  )
}

function RankChart({ data }: { data: RankDay[] }) {
  const W = 380, H = 200
  const pad = { top: 10, right: 8, bottom: 26, left: 36 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  const allRanks = data.map(d => Number(d.club_rank))
  const sorted = [...allRanks].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1
  const filtered = data.filter(d => Number(d.club_rank) <= median * 5)
  const ranks = filtered.map(d => Number(d.club_rank))
  const minR = Math.min(...ranks)
  const maxR = Math.max(...ranks)
  const range = maxR - minR || 1

  const xOf = (i: number) => pad.left + (i / Math.max(filtered.length - 1, 1)) * plotW
  // lower rank number = better = higher on chart (lower y)
  const yOf = (r: number) => pad.top + ((r - minR) / range) * plotH

  const points = ranks.map((r, i) => `${xOf(i)},${yOf(r)}`).join(' ')

  const xStep = Math.max(1, Math.floor(filtered.length / 4))
  const lastIdx = filtered.length - 1
  const prevRegular = Math.floor(lastIdx / xStep) * xStep
  const xLabelIdxs = filtered.map((_, i) => i).filter(i =>
    i % xStep === 0 || (i === lastIdx && lastIdx !== prevRegular && (lastIdx - prevRegular) * 2 > xStep)
  )

  const yTicks = minR === maxR ? [minR] : [minR, Math.round((minR + maxR) / 2), maxR]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {yTicks.map(r => (
        <g key={r}>
          <line x1={pad.left} y1={yOf(r)} x2={W - pad.right} y2={yOf(r)} stroke="#ffffff08" strokeWidth="1" />
          <text x={pad.left - 4} y={yOf(r) + 4} textAnchor="end" fontSize="9" fill="#52525b">#{r}</text>
        </g>
      ))}

      <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />

      <circle
        cx={xOf(filtered.length - 1)}
        cy={yOf(ranks[ranks.length - 1])}
        r="3" fill="#6366f1"
      />

      {xLabelIdxs.map(i => (
        <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#52525b">
          {new Date(filtered[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}
    </svg>
  )
}

function formatFans(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`
  return String(n)
}
