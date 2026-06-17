import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import Link from 'next/link'

type Entry = {
  trainer_name: string
  trainer_id: string
  club_name: string
  date: string
  cumulative_fans: string
  expected_fans: string
  deficit_surplus: string
  days_behind: string
}

const RANGES = [
  { label: '7d',  value: '7',   days: 7 },
  { label: '30d', value: '30',  days: 30 },
  { label: '90d', value: '90',  days: 90 },
  { label: 'All', value: 'all', days: null },
]

export default async function QuotaPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; trainer?: string }>
}) {
  const { range = '30', trainer } = await searchParams
  const rangeConfig = RANGES.find(r => r.value === range) ?? RANGES[1]

  const session = await auth()
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  if (!active) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-white">Quota History</h1>
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-10 text-center text-xs text-zinc-600">
          No club selected. Add a club or pick one from the switcher above.
        </div>
      </div>
    )
  }

  // Scoped to the active club ($1); trainer is an optional $2.
  const params = trainer ? [active.club_id, trainer] : [active.club_id]
  const trainerFilter = trainer ? 'AND m.trainer_id = $2' : ''

  const entries = await query<Entry>(`
    SELECT
      m.trainer_name,
      m.trainer_id,
      c.club_name,
      qh.date::text,
      qh.cumulative_fans::text,
      qh.expected_fans::text,
      qh.deficit_surplus::text,
      qh.days_behind::text
    FROM quota_history qh
    JOIN members m ON m.member_id = qh.member_id
    JOIN clubs   c ON c.club_id::text = qh.club_id::text
    WHERE qh.club_id = $1
      ${rangeConfig.days ? `AND qh.date >= CURRENT_DATE - INTERVAL '${rangeConfig.days} days'` : ''}
      ${trainerFilter}
    ORDER BY qh.date DESC, m.trainer_name
    LIMIT 300
  `, params).catch(() => [])

  const summary = await query<{ on_track: string; behind: string; avg_surplus: string; total_fans: string }>(`
    SELECT
      COUNT(CASE WHEN qh.deficit_surplus >= 0 THEN 1 END)::text AS on_track,
      COUNT(CASE WHEN qh.deficit_surplus < 0  THEN 1 END)::text AS behind,
      ROUND(AVG(qh.deficit_surplus))::text                      AS avg_surplus,
      SUM(qh.cumulative_fans)::text                             AS total_fans
    FROM quota_history qh
    JOIN members m ON m.member_id = qh.member_id
    JOIN clubs   c ON c.club_id::text = qh.club_id::text
    WHERE qh.club_id = $1
      ${rangeConfig.days ? `AND qh.date >= CURRENT_DATE - INTERVAL '${rangeConfig.days} days'` : ''}
      ${trainerFilter}
  `, params).catch(() => [{ on_track: '0', behind: '0', avg_surplus: '0', total_fans: '0' }])

  const s = summary[0] ?? { on_track: '0', behind: '0', avg_surplus: '0', total_fans: '0' }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Quota History · {active.club_name}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{entries.length} entries</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-4">
          <p className="text-xs text-zinc-500">On track entries</p>
          <p className="mt-1.5 text-xl font-semibold text-emerald-400">{s.on_track}</p>
        </div>
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-4">
          <p className="text-xs text-zinc-500">Behind entries</p>
          <p className="mt-1.5 text-xl font-semibold text-amber-400">{s.behind}</p>
        </div>
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-4">
          <p className="text-xs text-zinc-500">Avg surplus / deficit</p>
          <p className={`mt-1.5 text-xl font-semibold ${Number(s.avg_surplus) >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {Number(s.avg_surplus) >= 0 ? '+' : ''}{formatFans(Number(s.avg_surplus))}
          </p>
        </div>
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-4">
          <p className="text-xs text-zinc-500">Total fans tracked</p>
          <p className="mt-1.5 text-xl font-semibold text-white">{formatFans(Number(s.total_fans))}</p>
        </div>
      </div>

      {/* Range + active filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-[#0d0d14] border border-white/5 rounded-lg p-1">
          {RANGES.map((r) => (
            <Link key={r.value}
              href={`?range=${r.value}${trainer ? `&trainer=${trainer}` : ''}`}
              className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${range === r.value ? 'bg-white/8 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {r.label}
            </Link>
          ))}
        </div>
        {trainer && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg">
            <span className="text-xs text-zinc-400">Trainer: {entries[0]?.trainer_name ?? trainer}</span>
            <Link href={`?range=${range}`} className="text-xs text-zinc-600 hover:text-zinc-400">×</Link>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Date</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Trainer</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Club</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Cumulative fans</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Expected</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Surplus / Deficit</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Days behind</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {entries.map((e, i) => {
              const val = Number(e.deficit_surplus)
              return (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-xs text-zinc-400">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <a href={`?range=${range}&trainer=${e.trainer_id}`}
                      className="text-xs text-zinc-200 hover:text-white transition-colors font-medium">
                      {e.trainer_name}
                    </a>
                    <p className="text-[10px] text-zinc-600">{e.trainer_id}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{e.club_name}</td>
                  <td className="px-5 py-3 text-xs text-zinc-300">{formatFans(Number(e.cumulative_fans))}</td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{formatFans(Number(e.expected_fans))}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${val >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {val >= 0 ? '+' : ''}{formatFans(val)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs ${Number(e.days_behind) > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {e.days_behind}d
                    </span>
                  </td>
                </tr>
              )
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-xs text-zinc-600 text-center">No quota data in this range</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

function formatFans(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`
  return String(n)
}
