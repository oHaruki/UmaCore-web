export type QuotaPoint = { date: string; cumulative: number; expected: number }

export default function QuotaChart({ data }: { data: QuotaPoint[] }) {
  const W = 800, H = 160
  const pad = { top: 8, right: 8, bottom: 24, left: 56 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  const maxY = Math.max(...data.map(d => Math.max(d.cumulative, d.expected)), 1)
  const xOf = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * plotW
  const yOf = (v: number) => pad.top + plotH - (v / maxY) * plotH

  const actual   = data.map((d, i) => `${xOf(i)},${yOf(d.cumulative)}`).join(' ')
  const expected = data.map((d, i) => `${xOf(i)},${yOf(d.expected)}`).join(' ')

  // Y axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: pad.top + plotH - t * plotH,
    label: formatFans(Math.round(maxY * t)),
  }))

  // X axis: show up to 6 dates
  const xStep = Math.max(1, Math.floor(data.length / 6))
  const xLabels = data
    .map((d, i) => ({ i, date: d.date }))
    .filter((_, i) => i % xStep === 0 || i === data.length - 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {/* Grid lines */}
      {yLabels.map(({ y, label }) => (
        <g key={label}>
          <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#ffffff08" strokeWidth="1" />
          <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#52525b">{label}</text>
        </g>
      ))}

      {/* Expected line (dashed) */}
      <polyline points={expected} fill="none" stroke="#3f3f46" strokeWidth="1.5" strokeDasharray="4 3" />

      {/* Actual line */}
      <polyline points={actual} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />

      {/* Latest dot */}
      {data.length > 0 && (
        <circle
          cx={xOf(data.length - 1)}
          cy={yOf(data[data.length - 1].cumulative)}
          r="3" fill="#10b981"
        />
      )}

      {/* X labels */}
      {xLabels.map(({ i, date }) => (
        <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#52525b">
          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}
    </svg>
  )
}

export function QuotaChartLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-emerald-500 inline-block" />Actual fans</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-zinc-600 inline-block border-dashed border-t border-zinc-600" />Expected</span>
    </div>
  )
}

export function formatFans(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`
  return String(n)
}
