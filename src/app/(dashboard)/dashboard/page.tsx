import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import Link from 'next/link'

type ClubStat = {
  club_id: string; club_name: string; daily_quota: string
  quota_period: string; is_active: boolean
  active_count: string; on_track: string; behind: string
}
type RecentEntry = {
  member_id: string; trainer_name: string; club_name: string
  date: string; deficit_surplus: string; cumulative_fans: string
}
type AtRisk = {
  member_id: string; trainer_name: string; club_name: string
  days_behind: string; deficit_surplus: string; bomb_active: boolean; bomb_days: number | null
}
type RankPoint = {
  club_id: string; club_name: string; date: string; club_rank: string
}

export default async function DashboardPage() {
  const session = await auth()

  const [clubStats, recent, atRisk, rankHistory] = await Promise.all([
    query<ClubStat>(`
      SELECT c.club_id, c.club_name, c.daily_quota::text, c.quota_period, c.is_active,
        COUNT(m.member_id) FILTER (WHERE m.is_active)::text AS active_count,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus >= 0)::text AS on_track,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus < 0)::text AS behind
      FROM clubs c
      LEFT JOIN members m ON m.club_id = c.club_id
      LEFT JOIN LATERAL (
        SELECT deficit_surplus FROM quota_history WHERE member_id = m.member_id ORDER BY date DESC LIMIT 1
      ) lat ON true
      GROUP BY c.club_id ORDER BY c.club_name
    `).catch(() => []),

    query<RecentEntry>(`
      SELECT m.member_id, m.trainer_name, c.club_name, qh.date::text,
             qh.deficit_surplus::text, qh.cumulative_fans::text
      FROM quota_history qh
      JOIN members m ON m.member_id = qh.member_id
      JOIN clubs c ON c.club_id = qh.club_id
      ORDER BY qh.date DESC, qh.created_at DESC LIMIT 8
    `).catch(() => []),

    query<AtRisk>(`
      SELECT m.member_id, m.trainer_name, c.club_name,
             lat.days_behind::text, lat.deficit_surplus::text,
             (b.bomb_id IS NOT NULL AND b.is_active)  AS bomb_active,
             b.days_remaining                          AS bomb_days
      FROM members m
      JOIN clubs c ON c.club_id = m.club_id
      LEFT JOIN LATERAL (
        SELECT days_behind, deficit_surplus FROM quota_history
        WHERE member_id = m.member_id ORDER BY date DESC LIMIT 1
      ) lat ON true
      LEFT JOIN bombs b ON b.member_id = m.member_id AND b.is_active = true
      WHERE m.is_active = true
        AND (lat.days_behind > 0 OR (b.bomb_id IS NOT NULL AND b.is_active))
      ORDER BY bomb_active DESC, lat.days_behind DESC
      LIMIT 10
    `).catch(() => []),

    query<RankPoint>(`
      SELECT crh.club_id::text, c.club_name, crh.date::text, crh.club_rank::text
      FROM club_rank_history crh
      JOIN clubs c ON c.club_id = crh.club_id
      WHERE crh.date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY c.club_name, crh.date ASC
    `).catch(() => []),
  ])

  const totals = clubStats.reduce(
    (a, c) => ({ members: a.members + Number(c.active_count), onTrack: a.onTrack + Number(c.on_track), behind: a.behind + Number(c.behind) }),
    { members: 0, onTrack: 0, behind: 0 }
  )

  // Group rank history by club
  const rankByClub = rankHistory.reduce<Record<string, RankPoint[]>>((acc, r) => {
    (acc[r.club_id] ??= []).push(r)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Overview</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <span className="text-xs text-zinc-600">{session?.user?.name}</span>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Active members', value: totals.members },
          { label: 'On track',       value: totals.onTrack,  color: 'text-emerald-400' },
          { label: 'Behind quota',   value: totals.behind,   color: totals.behind > 0 ? 'text-amber-400' : undefined },
          { label: 'Active clubs',   value: clubStats.filter(c => c.is_active).length },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0d0d14] border border-white/5 rounded-lg p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`mt-1.5 text-2xl font-semibold ${color ?? 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* At-risk alert */}
      {atRisk.length > 0 && (
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <p className="text-sm font-medium text-white">Needs attention</p>
            </div>
            <Link href="/dashboard/members?filter=active" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">View all →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {atRisk.map(m => (
              <div key={m.member_id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Link href={`/dashboard/members/${m.member_id}`}
                    className="text-xs font-medium text-zinc-200 hover:text-white transition-colors truncate">
                    {m.trainer_name}
                  </Link>
                  <span className="text-[10px] text-zinc-600 shrink-0">{m.club_name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {m.bomb_active && (
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      (m.bomb_days ?? 0) <= 1 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      💣 {m.bomb_days}d
                    </span>
                  )}
                  <span className="text-xs text-amber-400">{m.days_behind}d behind</span>
                  <span className={`text-xs font-medium ${Number(m.deficit_surplus) >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {Number(m.deficit_surplus) >= 0 ? '+' : ''}{formatFans(Number(m.deficit_surplus))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-4">

        {/* Club cards */}
        <div className="col-span-3 space-y-3">
          {clubStats.map(club => {
            const total   = Number(club.active_count)
            const onTrack = Number(club.on_track)
            const pct     = total > 0 ? Math.round((onTrack / total) * 100) : 0
            const rankData = rankByClub[club.club_id] ?? []
            const latestRank = rankData[rankData.length - 1]?.club_rank

            return (
              <div key={club.club_id} className="bg-[#0d0d14] border border-white/5 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${club.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <p className="text-sm font-medium text-white">{club.club_name}</p>
                    <span className="text-xs text-zinc-600 capitalize">{club.quota_period}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {latestRank && (
                      <span className="text-xs text-zinc-500">Rank #{latestRank}</span>
                    )}
                    <span className="text-xs text-zinc-500">{formatFans(Number(club.daily_quota))} / day</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Members</p><p className="text-sm font-medium text-white">{club.active_count}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">On track</p><p className="text-sm font-medium text-emerald-400">{club.on_track}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Behind</p><p className="text-sm font-medium text-amber-400">{club.behind}</p></div>
                </div>

                {/* Quota health bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
                    <span>Quota health</span><span>{pct}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Rank sparkline */}
                {rankData.length >= 2 && (
                  <RankSparkline data={rankData.map(r => Number(r.club_rank))} />
                )}
              </div>
            )
          })}
        </div>

        {/* Recent activity */}
        <div className="col-span-2 bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
            <p className="text-sm font-medium text-white">Recent activity</p>
            <Link href="/dashboard/quota" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">All →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {recent.map((e, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/dashboard/members/${e.member_id}`}
                    className="text-xs text-zinc-200 font-medium hover:text-white transition-colors truncate block">
                    {e.trainer_name}
                  </Link>
                  <p className="text-[10px] text-zinc-600 truncate">{e.club_name} · {new Date(e.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-medium ${Number(e.deficit_surplus) >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {Number(e.deficit_surplus) >= 0 ? '+' : ''}{formatFans(Number(e.deficit_surplus))}
                  </p>
                  <p className="text-[10px] text-zinc-600">{formatFans(Number(e.cumulative_fans))}</p>
                </div>
              </div>
            ))}
            {recent.length === 0 && <p className="px-5 py-6 text-xs text-zinc-600">No activity yet</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function RankSparkline({ data }: { data: number[] }) {
  const W = 200, H = 28
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  // Rank: lower = better, so invert Y
  const xOf = (i: number) => (i / Math.max(data.length - 1, 1)) * W
  const yOf = (v: number) => H - ((max - v) / range) * H
  const points = data.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')

  return (
    <div>
      <p className="text-[10px] text-zinc-600 mb-1">Club rank (30d) — lower is better</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 28 }}>
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={xOf(data.length - 1)} cy={yOf(data[data.length - 1])} r="2.5" fill="#6366f1" />
      </svg>
    </div>
  )
}

function formatFans(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`
  return String(n)
}
