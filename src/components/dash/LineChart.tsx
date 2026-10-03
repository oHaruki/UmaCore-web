'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { formatDay, formatFans } from '@/lib/format'

export type ChartSeries = {
  key: string
  label: string
  /** One value per label; null leaves a gap (e.g. future days, or past days for a projection). */
  values: (number | null)[]
  color: string
  dashed?: boolean
  area?: boolean
}

const PAD = { top: 12, right: 12, bottom: 26, left: 48 }

// Formatters are named rather than passed in, since server pages can't hand functions to a client component.
const FORMATS = {
  fans: (n: number) => formatFans(Math.round(n)),
  percent: (n: number) => `${Math.round(n)}%`,
  rank: (n: number) => `#${Math.round(n)}`,
  number: (n: number) => String(Math.round(n)),
}
export type ChartFormat = keyof typeof FORMATS

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || Math.abs(max) || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6)
  return ticks.length > 1 ? ticks : [lo, lo + step]
}

export default function LineChart({
  labels,
  series,
  height = 220,
  format: formatName = 'number',
  invert = false,
  zeroBased = false,
  clamp,
}: {
  /** YYYY-MM-DD per point */
  labels: string[]
  series: ChartSeries[]
  height?: number
  format?: ChartFormat
  /** Lower values drawn higher, for ranks. */
  invert?: boolean
  zeroBased?: boolean
  clamp?: [number, number]
}) {
  const format = FORMATS[formatName]
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId().replace(/:/g, '')

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = labels.length
  const all = series.flatMap(s => s.values.filter((v): v is number => v !== null && Number.isFinite(v)))
  let min = all.length ? Math.min(...all) : 0
  let max = all.length ? Math.max(...all) : 1
  if (zeroBased) min = Math.min(0, min)
  const ticks = niceTicks(min, max)
  min = ticks[0]
  max = ticks[ticks.length - 1]
  if (clamp) {
    min = Math.max(clamp[0], min)
    max = Math.min(clamp[1], max)
  }
  const range = max - min || 1
  const yTicks = ticks.filter(t => t >= min && t <= max)

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const xOf = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
  const yOf = (v: number) => {
    const t = (v - min) / range
    return PAD.top + (invert ? t : 1 - t) * plotH
  }

  function pathFor(values: (number | null)[]) {
    let d = ''
    let pen = false
    values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) { pen = false; return }
      d += `${pen ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`
      pen = true
    })
    return d
  }

  function areaFor(values: (number | null)[]) {
    const pts = values.map((v, i) => (v === null ? null : [xOf(i), yOf(v)] as const)).filter(Boolean) as [number, number][]
    if (pts.length < 2) return ''
    const base = PAD.top + plotH
    return `M${pts[0][0]},${base}` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join('') + `L${pts[pts.length - 1][0]},${base}Z`
  }

  const xLabelCount = Math.max(2, Math.min(6, Math.floor(plotW / 90)))
  const xIdx = n <= 1 ? [0] : Array.from(new Set(
    Array.from({ length: xLabelCount }, (_, k) => Math.round((k / (xLabelCount - 1)) * (n - 1)))
  ))

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (n === 0 || plotW <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - PAD.left
    const i = Math.round((x / plotW) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  const tipLeft = hover !== null ? xOf(hover) : 0
  const tipFlip = tipLeft > width * 0.62

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block touch-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={series.map(s => s.label).join(', ')}
        >
          <defs>
            {series.filter(s => s.area).map(s => (
              <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {yTicks.map(t => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={yOf(t)} y2={yOf(t)} stroke="var(--uc-line)" />
              <text x={PAD.left - 8} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="var(--uc-fg-subtle)" className="num">
                {format(t)}
              </text>
            </g>
          ))}

          {xIdx.map(i => (
            <text
              key={i}
              x={xOf(i)}
              y={height - 6}
              textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}
              fontSize="11"
              fill="var(--uc-fg-subtle)"
            >
              {labels[i] ? formatDay(labels[i]) : ''}
            </text>
          ))}

          {series.filter(s => s.area).map(s => (
            <path key={`a-${s.key}`} d={areaFor(s.values)} fill={`url(#${gid}-${s.key})`} />
          ))}

          {series.map(s => (
            <path
              key={s.key}
              d={pathFor(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dashed ? 1.5 : 2}
              strokeDasharray={s.dashed ? '4 4' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Latest point of each solid series */}
          {hover === null && series.filter(s => !s.dashed).map(s => {
            const last = s.values.findLastIndex(v => v !== null)
            if (last < 0) return null
            return <circle key={`l-${s.key}`} cx={xOf(last)} cy={yOf(s.values[last]!)} r={3.5} fill={s.color} stroke="var(--uc-surface)" strokeWidth={2} />
          })}

          {hover !== null && (
            <g pointerEvents="none">
              <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--uc-line-strong)" />
              {series.map(s => {
                const v = s.values[hover]
                if (v === null || v === undefined) return null
                return <circle key={`h-${s.key}`} cx={xOf(hover)} cy={yOf(v)} r={4} fill={s.color} stroke="var(--uc-surface)" strokeWidth={2} />
              })}
            </g>
          )}
        </svg>
      )}

      {hover !== null && labels[hover] && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-[10px] border border-line-strong bg-surface-3/95 px-3 py-2 shadow-[0_12px_28px_-10px_oklch(0.05_0.03_285/80%)] backdrop-blur-sm"
          style={{ left: tipLeft, transform: `translateX(${tipFlip ? 'calc(-100% - 12px)' : '12px'})` }}
        >
          <p className="mb-1 text-xs font-medium text-fg-soft">
            {formatDay(labels[hover], { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          {series.map(s => {
            const v = s.values[hover]
            if (v === null || v === undefined) return null
            return (
              <p key={s.key} className="flex items-center gap-2 text-xs text-fg-muted">
                <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                {s.label}
                <span className="num ml-auto pl-3 font-medium text-fg">{format(v)}</span>
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map(i => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3.5"
            style={{ borderTop: `2px ${i.dashed ? 'dashed' : 'solid'} ${i.color}` }}
          />
          {i.label}
        </span>
      ))}
    </div>
  )
}
