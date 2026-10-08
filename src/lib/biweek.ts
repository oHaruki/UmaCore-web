// Biweeks on a club's own 14-day cycle (clubs.period_anchor_date), matching
// QuotaCalculator.get_period_info in the bot. Days are 'YYYY-MM-DD'.

const DAY_MS = 86_400_000

function toUtc(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function toDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}

/** A real calendar date in 'YYYY-MM-DD' form (rejects 2026-02-30). */
export function isDayKey(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toDay(toUtc(s)) === s
}

/** `count` back-to-back biweeks on the cycle through `anchor`, starting with the one holding `day`. */
export function biweeksFrom(anchor: string, day: string, count: number) {
  const offset = Math.floor((toUtc(day) - toUtc(anchor)) / DAY_MS / 14) * 14
  const first = toUtc(anchor) + offset * DAY_MS
  return Array.from({ length: count }, (_, i) => {
    const start = first + i * 14 * DAY_MS
    return { start: toDay(start), end: toDay(start + 13 * DAY_MS) }
  })
}
