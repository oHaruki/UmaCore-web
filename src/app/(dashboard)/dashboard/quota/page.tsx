import { query } from '@/lib/db'

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

type Club = { club_id: string; club_name: string }

const RANGES = [
  { label: '7d',  value: '7',   days: 7 },
  { label: '30d', value: '30',  days: 30 },
  { label: '90d', value: '90',  days: 90 },
  { label: 'All', value: 'all', days: null },
]

export default async function QuotaPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; club?: string; trainer?: string }>
}) {
  const { range = '30', club, trainer } = await searchParams
  const rangeConfig = RANGES.find(r => r.value === range) ?? RANGES[1]

  const clubs = await query<Club>('SELECT club_id, club_name FROM clubs ORDER BY club_name').catch(() => [])

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
    JOIN clubs   c ON c.club_id   = qh.club_id
    WHERE 1=1
      ${rangeConfig.days ? `AND qh.date >= CURRENT_DATE - INTERVAL '${rangeConfig.days} days'` : ''}
      ${club    ? 'AND qh.club_id = $1'         : ''}
      ${trainer ? `AND m.trainer_id = $${club ? 2 : 1}` : ''}
    ORDER BY qh.date DESC, m.trainer_name
    LIMIT 300
  `, [club, trainer].filter(Boolean)).catch(() => [])

  const summary = await query<{ on_track: string; behind: string; avg_surplus: string; total_fans: string }>(`
    SELECT
      COUNT(CASE WHEN qh.deficit_surplus >= 0 THEN 1 END)::text AS on_track,
      COUNT(CASE WHEN qh.deficit_surplus < 0  THEN 1 END)::text AS behind,
      ROUND(AVG(qh.deficit_surplus))::text                      AS avg_surplus,
      SUM(qh.cumulative_fans)::text                             AS total_fans
    FROM quota_history qh
    JOIN members m ON m.member_id = qh.member_id
    WHERE 1=1
      ${rangeConfig.days ? `AND qh.date >= CURRENT_DATE - INTERVAL '${rangeConfig.days} days'` : ''}
      ${club    ? 'AND qh.club_id = $1'         : ''}
      ${trainer ? `AND m.trainer_id = $${club ? 2 : 1}` : ''}
  `, [club, trainer].filter(Boolean)).catch(() => [{ on_track: '0', behind: '0', avg_surplus: '0', total_fans: '0' }])

  const s = summary[0] ?? { on_track: '0', behind: '0', avg_surplus: '0', total_fans: '0' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Quota History</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{entries.length} entries</p>
        </div>

        {/* Club filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">Club</span>
          <div className="flex items-center gap-1 bg-[#0d0d14] border border-white/5 rounded-lg p-1">
            <a href={`?range=${range}${trainer ? `&trainer=${trainer}` : ''}`}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${!club ? 'bg-white/8 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              All
            </a>
            {clubs.map((c) => (
              <a key={c.club_id}
                href={`?range=${range}&club=${c.club_id}${trainer ? `&trainer=${trainer}` : ''}`}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${club === c.club_id ? 'bg-white/8 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {c.club_name}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
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
            <a key={r.value}
              href={`?range=${r.value}${club ? `&club=${club}` : ''}${trainer ? `&trainer=${trainer}` : ''}`}
              className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${range === r.value ? 'bg-white/8 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {r.label}
            </a>
          ))}
        </div>
        {trainer && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg">
            <span className="text-xs text-zinc-400">Trainer: {entries[0]?.trainer_name ?? trainer}</span>
            <a href={`?range=${range}${club ? `&club=${club}` : ''}`} className="text-xs text-zinc-600 hover:text-zinc-400">×</a>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
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
                    <a href={`?range=${range}${club ? `&club=${club}` : ''}&trainer=${e.trainer_id}`}
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
  )
}

function formatFans(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`
  return String(n)
}
