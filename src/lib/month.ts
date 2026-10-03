// Quota runs in calendar months: the bot keeps every day's row, but cumulative fans
// restart on the 1st. Months are passed around as 'YYYY-MM'.

export function isMonthKey(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
}

/** '2026-09' -> '2026-09-01', for SQL range bounds. */
export function monthStart(key: string) {
  return `${key}-01`
}

export function shiftMonth(key: string, by: number) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function daysInMonth(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function monthLabel(key: string, opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }) {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })
}

/** SQL condition: `column` falls in the month that starts at date parameter `param` (e.g. '$2'). */
export function inMonthSql(column: string, param: string) {
  return `${column} >= ${param}::date AND ${column} < (${param}::date + INTERVAL '1 month')`
}
