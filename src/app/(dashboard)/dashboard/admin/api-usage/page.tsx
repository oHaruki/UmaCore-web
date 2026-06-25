import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { query, queryOne } from '@/lib/db'

const OWNER_ID = '139769063948681217'

// Matches the bot's default uma.moe limiter budget; override via env if changed.
const RATE_PER_MIN = Number(process.env.UMAMOE_RATE_PER_MIN ?? 100)

export const dynamic = 'force-dynamic'

type Totals = {
  calls_24h: number
  calls_7d: number
  calls_30d: number
  errors_7d: number
  rl_7d: number
  calls_total: number
}

type DayRow = { day: string; total: number; errors: number }
type EndpointRow = {
  provider: string
  endpoint: string
  calls: number
  errors: number
  avg_ms: number | null
}
type ErrorRow = {
  provider: string
  endpoint: string
  status_code: number | null
  context: string | null
  created_at: string
}

export default async function ApiUsagePage() {
  const session = await auth()
  if (!session || session.user.id !== OWNER_ID) redirect('/dashboard')

  const [totals, daily, endpoints, peak, errors] = await Promise.all([
    queryOne<Totals>(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')                       AS calls_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')                         AS calls_7d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')                        AS calls_30d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND NOT ok)              AS errors_7d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND status_code = 429)   AS rl_7d,
        COUNT(*)                                                                                AS calls_total
      FROM api_usage
    `).catch(() => null),
    query<DayRow>(`
      SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)                          AS total,
        COUNT(*) FILTER (WHERE NOT ok)    AS errors
      FROM api_usage
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1
    `).catch(() => []),
    query<EndpointRow>(`
      SELECT
        provider,
        endpoint,
        COUNT(*)                          AS calls,
        COUNT(*) FILTER (WHERE NOT ok)    AS errors,
        ROUND(AVG(duration_ms))           AS avg_ms
      FROM api_usage
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY provider, endpoint
      ORDER BY COUNT(*) DESC
    `).catch(() => []),
    queryOne<{ peak_per_min: number }>(`
      SELECT COALESCE(MAX(c), 0) AS peak_per_min
      FROM (
        SELECT COUNT(*) AS c
        FROM api_usage
        WHERE provider = 'uma.moe' AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY date_trunc('minute', created_at)
      ) x
    `).catch(() => null),
    query<ErrorRow>(`
      SELECT provider, endpoint, status_code, context,
             to_char(created_at, 'Mon DD HH24:MI') AS created_at
      FROM api_usage
      WHERE NOT ok
      ORDER BY created_at DESC
      LIMIT 15
    `).catch(() => []),
  ])

  const t = totals ?? {
    calls_24h: 0, calls_7d: 0, calls_30d: 0, errors_7d: 0, rl_7d: 0, calls_total: 0,
  }
  const errorRate7d = Number(t.calls_7d) > 0
    ? (Number(t.errors_7d) / Number(t.calls_7d)) * 100
    : 0
  const peakPerMin = Number(peak?.peak_per_min ?? 0)
  const peakPct = RATE_PER_MIN > 0 ? Math.min(100, (peakPerMin / RATE_PER_MIN) * 100) : 0

  const kpis = [
    { label: 'Calls (24h)', value: Number(t.calls_24h) },
    { label: 'Calls (7d)', value: Number(t.calls_7d) },
    { label: 'Calls (30d)', value: Number(t.calls_30d) },
    { label: 'Error rate (7d)', value: `${errorRate7d.toFixed(1)}%`, warn: errorRate7d >= 5 },
    { label: 'Rate-limited (7d)', value: Number(t.rl_7d), warn: Number(t.rl_7d) > 0 },
    { label: 'Total logged', value: Number(t.calls_total) },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">API Usage</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Owner-only. Outbound requests to uma.moe &amp; gametora.
        </p>
      </div>

      {/* KPI grid */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map(({ label, value, warn }) => (
            <div key={label} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-4">
              <p className="text-xs text-zinc-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${warn ? 'text-amber-400' : 'text-white'}`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Rate-limit headroom */}
      <section className="rounded-xl border border-white/5 bg-white/[0.03] px-5 py-4">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-semibold text-zinc-300">uma.moe rate-limit headroom</h2>
          <span className="text-xs text-zinc-500">
            peak {peakPerMin}/min in last 24h · limit {RATE_PER_MIN}/min
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              peakPct >= 90 ? 'bg-red-500' : peakPct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.max(2, peakPct)}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          {peakPct >= 90
            ? 'Close to the limit — consider spacing out scrapes.'
            : peakPct >= 70
            ? 'Moderate headroom.'
            : 'Plenty of headroom.'}
        </p>
      </section>

      {/* Daily volume chart */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Calls per day (30d)
        </h2>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-4">
          {daily.length > 0 ? (
            <DailyBars data={daily} />
          ) : (
            <p className="text-sm text-zinc-500 py-8 text-center">No API calls recorded yet.</p>
          )}
        </div>
      </section>

      {/* Endpoint breakdown */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          By endpoint (7d)
        </h2>
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Provider</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Endpoint</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Calls</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Errors</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Avg ms</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.length > 0 ? endpoints.map((e, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-zinc-300">{e.provider}</td>
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{e.endpoint}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{Number(e.calls).toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right ${Number(e.errors) > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {Number(e.errors).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400">{e.avg_ms != null ? Number(e.avg_ms).toLocaleString() : '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No data in the last 7 days.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent errors */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Recent failures
        </h2>
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">When</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Provider</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Endpoint</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Context</th>
              </tr>
            </thead>
            <tbody>
              {errors.length > 0 ? errors.map((e, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{e.created_at}</td>
                  <td className="px-4 py-3 text-zinc-300">{e.provider}</td>
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{e.endpoint}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-red-400 font-mono text-xs">{e.status_code ?? 'net'}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 font-mono text-xs truncate max-w-[200px]" title={e.context ?? ''}>
                    {e.context ?? '—'}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No failures recorded. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function DailyBars({ data }: { data: DayRow[] }) {
  const W = 800, H = 180
  const pad = { top: 10, right: 8, bottom: 24, left: 40 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom
  const max = Math.max(1, ...data.map((d) => Number(d.total)))
  const n = data.length
  const slot = plotW / n
  const barW = Math.max(2, Math.min(22, slot * 0.7))

  const yTicks = 4
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = (max / yTicks) * i
    const y = pad.top + plotH - (val / max) * plotH
    return { y, label: Math.round(val).toLocaleString() }
  })

  const labelEvery = Math.ceil(n / 8)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      {yLabels.map(({ y, label }) => (
        <g key={label + y}>
          <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#ffffff08" strokeWidth="1" />
          <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#52525b">{label}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const total = Number(d.total)
        const errs = Number(d.errors)
        const x = pad.left + slot * i + (slot - barW) / 2
        const hTotal = (total / max) * plotH
        const hErr = (errs / max) * plotH
        const yTotal = pad.top + plotH - hTotal
        const yErr = pad.top + plotH - hErr
        return (
          <g key={d.day}>
            <rect x={x} y={yTotal} width={barW} height={hTotal} rx={2} fill="#6366f1" />
            {errs > 0 && (
              <rect x={x} y={yErr} width={barW} height={hErr} rx={2} fill="#ef4444" />
            )}
            {i % labelEvery === 0 && (
              <text
                x={x + barW / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize="8"
                fill="#52525b"
              >
                {d.day.slice(5)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
