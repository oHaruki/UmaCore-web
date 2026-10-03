'use client'

import LineChart, { ChartLegend, type ChartSeries } from '@/components/dash/LineChart'

export type QuotaPoint = { date: string; cumulative: number; expected: number }

const ACTUAL = 'var(--uc-good)'
const EXPECTED = 'var(--uc-fg-subtle)'
const PROJECTED = 'var(--uc-brand)'

function addDays(d: string, n: number) {
  const t = new Date(d + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/**
 * Fans vs the expected line. With `projection`, both lines run on to the end of the
 * last data point's month: expected at the club's daily rate, projected at the given pace.
 */
export default function QuotaChart({
  data,
  projection,
  height = 240,
}: {
  data: QuotaPoint[]
  projection?: { pace: number; perDayQuota: number } | null
  height?: number
}) {
  const labels = data.map(d => d.date)
  const actual: (number | null)[] = data.map(d => d.cumulative)
  const expected: (number | null)[] = data.map(d => d.expected)
  let projected: (number | null)[] | null = null

  const last = data[data.length - 1]
  if (projection && last) {
    const [y, m, day] = last.date.split('-').map(Number)
    const daysLeft = new Date(Date.UTC(y, m, 0)).getUTCDate() - day
    if (daysLeft > 0) {
      projected = data.map((_, i) => (i === data.length - 1 ? last.cumulative : null))
      for (let k = 1; k <= daysLeft; k++) {
        labels.push(addDays(last.date, k))
        actual.push(null)
        expected.push(last.expected + projection.perDayQuota * k)
        projected.push(last.cumulative + projection.pace * k)
      }
    }
  }

  const series: ChartSeries[] = [
    { key: 'expected', label: 'Expected', values: expected, color: EXPECTED, dashed: true },
    ...(projected ? [{ key: 'projected', label: 'Projected', values: projected, color: PROJECTED, dashed: true }] : []),
    { key: 'actual', label: 'Fans', values: actual, color: ACTUAL, area: true },
  ]

  return <LineChart labels={labels} series={series} height={height} format="fans" zeroBased />
}

export function QuotaChartLegend({ projected = false }: { projected?: boolean }) {
  return (
    <ChartLegend
      items={[
        { label: 'Fans', color: ACTUAL },
        { label: 'Expected', color: EXPECTED, dashed: true },
        ...(projected ? [{ label: 'Projected', color: PROJECTED, dashed: true }] : []),
      ]}
    />
  )
}
