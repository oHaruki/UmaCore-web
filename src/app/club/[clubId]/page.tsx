import { query, queryOne } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// ── Types ──────────────────────────────────────────────────────
type PublicClub = {
  club_name: string
  daily_quota: string
  quota_period: string
  bombs_enabled: boolean
  public_enabled: boolean
}
type PublicMember = {
  member_id: string
  trainer_name: string
  deficit_surplus: string | null
  cumulative_fans: string | null
  days_behind: string | null
  has_bomb: boolean
  bomb_days_remaining: number | null
}
type LatestDate  = { latest_date: string | null; latest_scraped_at: string | null }
type RankRow     = { club_rank: number | null }

// ── Metadata ───────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: Promise<{ clubId: string }> }
): Promise<Metadata> {
  const { clubId } = await params
  const club = await queryOne<{ club_name: string; public_enabled: boolean }>(
    `SELECT club_name, public_enabled FROM clubs WHERE club_id = $1`, [clubId]
  ).catch(() => null)
  if (!club?.public_enabled) return { title: 'UmaCore' }
  return { title: `${club.club_name} — UmaCore` }
}

// ── Page ───────────────────────────────────────────────────────
export default async function PublicClubPage(
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params

  const club = await queryOne<PublicClub>(`
    SELECT club_name, daily_quota::text, quota_period, bombs_enabled, public_enabled
    FROM clubs WHERE club_id = $1
  `, [clubId]).catch(() => null)

  if (!club || !club.public_enabled) notFound()

  const [members, dateRows, rankRows] = await Promise.all([
    query<PublicMember>(`
      SELECT
        m.member_id::text,
        m.trainer_name,
        lat.deficit_surplus::text,
        lat.cumulative_fans::text,
        lat.days_behind::text,
        (b.bomb_id IS NOT NULL) AS has_bomb,
        b.days_remaining        AS bomb_days_remaining
      FROM members m
      LEFT JOIN LATERAL (
        SELECT deficit_surplus, cumulative_fans, days_behind
        FROM quota_history
        WHERE member_id = m.member_id
        ORDER BY date DESC LIMIT 1
      ) lat ON true
      LEFT JOIN bombs b ON b.member_id = m.member_id AND b.is_active = true
      WHERE m.club_id = $1 AND m.is_active = true
      ORDER BY COALESCE(lat.deficit_surplus, -999999999999) DESC
    `, [clubId]),
    query<LatestDate>(
      `SELECT MAX(date)::text AS latest_date, MAX(created_at)::text AS latest_scraped_at
       FROM quota_history WHERE club_id = $1`,
      [clubId]
    ),
    query<RankRow>(
      `SELECT club_rank FROM club_rank_history WHERE club_id = $1 ORDER BY date DESC LIMIT 2`,
      [clubId]
    ),
  ]).catch(() => [[], [], []] as [PublicMember[], LatestDate[], RankRow[]])

  // ── Aggregates ─────────────────────────────────────────────
  const latestDate    = dateRows[0]?.latest_date ?? null
  const total         = members.length
  const onTrack       = members.filter(m => Number(m.deficit_surplus ?? -1) >= 0).length
  const behind        = members.filter(m => Number(m.deficit_surplus ?? -1) < 0 && !m.has_bomb).length
  const bombCount     = members.filter(m => m.has_bomb).length
  const bombMembers   = members.filter(m => m.has_bomb)
  const totalFans     = members.reduce((s, m) => s + (m.cumulative_fans  ? Number(m.cumulative_fans)  : 0), 0)
  const totalSurplus  = members.reduce((s, m) => s + (m.deficit_surplus  ? Number(m.deficit_surplus)  : 0), 0)
  const totalExpected = totalFans - totalSurplus
  const fanProgressPct = totalExpected > 0
    ? Math.min(100, Math.round((totalFans / totalExpected) * 100)) : 0
  const healthPct     = total > 0 ? Math.round((onTrack / total) * 100) : 0
  const maxAbsSurplus = members.reduce((max, m) =>
    Math.max(max, m.deficit_surplus ? Math.abs(Number(m.deficit_surplus)) : 0), 1)

  // ── Club rank ──────────────────────────────────────────────
  const latestRank = rankRows[0]?.club_rank ?? null
  const prevRank   = rankRows[1]?.club_rank ?? null
  const rankDelta  = latestRank && prevRank ? prevRank - latestRank : null // positive = improved

  // ── Dates & staleness ─────────────────────────────────────
  // latestDate  = the quota_history `date` column — on May 1 the bot stores this
  //               as April 30 because Uma.moe hasn't refreshed yet.
  // latestScrapedAt = MAX(created_at) — the actual wall-clock time the scrape ran.
  //               This is May 1 even when the stored date is April 30.
  // We use latestScrapedAt for staleness so "scrape ran today, data stored as Apr 30"
  // is correctly treated as fresh, not pending.
  const now             = new Date()
  const todayMidnight   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dataDateObj     = latestDate           ? new Date(latestDate + 'T00:00:00')           : null
  const scrapeObj       = dateRows[0]?.latest_scraped_at
                          ? new Date(dateRows[0].latest_scraped_at) : null
  const scrapeMidnight  = scrapeObj
                          ? new Date(scrapeObj.getFullYear(), scrapeObj.getMonth(), scrapeObj.getDate())
                          : null
  const daysSinceScrape = scrapeMidnight
    ? Math.round((todayMidnight.getTime() - scrapeMidnight.getTime()) / 86_400_000)
    : null

  // "New month pending" = data date is last month AND scrape hasn't run today yet
  const isNewMonthPending = dataDateObj !== null
    && dataDateObj.getMonth() !== todayMidnight.getMonth()
    && (daysSinceScrape === null || daysSinceScrape >= 1)

  // Generic stale = scrape missed for 1+ days within the same month
  const isStale = daysSinceScrape !== null && daysSinceScrape >= 1 && !isNewMonthPending

  // Month bar tracks SCRAPING progress, not the calendar.
  // latestDate = April 29 → "Day 29 of 30", 1 day of April data still incoming.
  // On May 1 the bot will store that day as April 30 (Uma.moe previous-month fetch).
  const ref           = dataDateObj ?? todayMidnight
  const daysInMonth   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
  const dayOfMonth    = ref.getDate()
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth) // days of data still to come
  const monthPct      = Math.round((dayOfMonth / daysInMonth) * 100)
  const monthName     = ref.toLocaleString('en', { month: 'long' })
  const nextMonthName = todayMidnight.toLocaleString('en', { month: 'long' })

  const periodLabel = club.quota_period === 'daily' ? 'day'
    : club.quota_period === 'weekly' ? 'week' : 'two weeks'
  const dailyQuota  = Number(club.daily_quota)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">

      {/* ── Nav ───────────────────────────────────────────────── */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between shrink-0">
        <span className="font-bold tracking-tight text-white">UmaCore</span>
        <span className="text-[11px] text-zinc-600">Club Dashboard</span>
      </header>

      {/* ── Status banner ──────────────────────────────────────── */}
      {isNewMonthPending && daysRemaining > 0 && (
        <div className="bg-violet-500/8 border-b border-violet-500/20 px-6 py-2.5 flex items-center gap-2">
          <span className="text-violet-400 text-xs">◌</span>
          <p className="text-xs text-violet-400/80">
            {monthName} day {dayOfMonth + 1} data incoming — today&apos;s scrape fetches the final day from Uma.moe (updates ~16:00 UTC).
          </p>
        </div>
      )}
      {isNewMonthPending && daysRemaining === 0 && (
        <div className="bg-violet-500/8 border-b border-violet-500/20 px-6 py-2.5 flex items-center gap-2">
          <span className="text-violet-400 text-xs">◌</span>
          <p className="text-xs text-violet-400/80">
            {monthName} complete — {nextMonthName} tracking begins after today&apos;s scrape.
          </p>
        </div>
      )}
      {isStale && (
        <div className="bg-amber-500/8 border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-2">
          <span className="text-amber-400 text-xs">⚠</span>
          <p className="text-xs text-amber-400/80">
            Showing {monthName} through day {dayOfMonth} — {daysSinceScrape} day{daysSinceScrape !== 1 ? 's' : ''} of data missing, bot may not have run.
          </p>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">

        {/* ── Sidebar ───────────────────────────────────────────── */}
        <aside className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-white/5
                          flex flex-col p-6 lg:p-8 gap-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">

          {/* Club identity */}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
              {club.club_name}
            </h1>
            <p className="text-xs text-zinc-500 mt-1.5">
              Uma Musume · {fmt(dailyQuota)} fans per {periodLabel}
            </p>
          </div>

          {/* Month progress */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-zinc-500">{monthName}</p>
              <p className="text-xs text-zinc-400">
                Day <span className="font-semibold text-white">{dayOfMonth}</span> of {daysInMonth}
                <span className="text-zinc-600"> · {daysRemaining}d left</span>
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full bg-violet-500/60 rounded-full" style={{ width: `${monthPct}%` }} />
            </div>
          </div>

          {/* Stats */}
          <div className="bg-[#0d0d14] border border-white/5 rounded-xl overflow-hidden divide-y divide-white/5">
            {latestRank && (
              <StatRow
                label="Club rank"
                value={`#${latestRank}`}
                isText
                sub={rankDelta !== null && rankDelta !== 0
                  ? rankDelta > 0
                    ? { text: `↑${rankDelta} today`, color: 'emerald' }
                    : { text: `↓${Math.abs(rankDelta)} today`, color: 'red' }
                  : undefined}
              />
            )}
            <StatRow value={total}   label="Members" />
            <StatRow value={onTrack} label="On Track" color="emerald" />
            <StatRow value={behind + bombCount} label="Behind"
              color={(behind + bombCount) > 0 ? 'amber' : undefined} />
            {club.bombs_enabled && bombCount > 0 && (
              <StatRow value={bombCount} label="Bombs" color="red" />
            )}
            <StatRow value={fmtLarge(totalFans)} label="Total fans" isText />
          </div>

          {/* Fan health */}
          {totalExpected > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">Fan health</p>
                <p className={`text-xs font-semibold tabular-nums
                  ${totalSurplus >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalSurplus >= 0 ? '+' : ''}{fmt(totalSurplus)}
                </p>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${totalSurplus >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${fanProgressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-600">{fmtLarge(totalFans)} collected</span>
                <span className="text-[10px] text-zinc-600">{fmtLarge(totalExpected)} expected</span>
              </div>
              {totalSurplus < 0 && (
                <p className="text-[10px] text-zinc-600">
                  Club needs{' '}
                  <span className="text-zinc-400 font-medium">{fmtLarge(Math.abs(totalSurplus))}</span>
                  {' '}more fans to be fully on track
                </p>
              )}
            </div>
          )}

          {/* Member health */}
          {total > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">Member health</p>
                <p className="text-xs font-semibold text-white">{healthPct}%</p>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
                {onTrack > 0 && (
                  <div className="bg-emerald-500 h-full" style={{ width: `${(onTrack / total) * 100}%` }} />
                )}
                {behind > 0 && (
                  <div className="bg-amber-500 h-full" style={{ width: `${(behind / total) * 100}%` }} />
                )}
                {bombCount > 0 && (
                  <div className="bg-red-500 h-full" style={{ width: `${(bombCount / total) * 100}%` }} />
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {onTrack > 0   && <Dot color="emerald" label={`${onTrack} on track`} />}
                {behind > 0    && <Dot color="amber"   label={`${behind} behind`} />}
                {bombCount > 0 && <Dot color="red"     label={`${bombCount} bomb${bombCount > 1 ? 's' : ''}`} />}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-2 space-y-1">
            <p className="text-[11px] text-zinc-700">
              {latestDate ? `Data from ${latestDate}` : 'No data yet'}
            </p>
            <p className="text-[11px] text-zinc-700">
              Powered by <span className="text-zinc-500">UmaCore</span>
            </p>
          </div>
        </aside>

        {/* ── Main content ───────────────────────────────────────── */}
        <main className="flex-1 p-6 lg:p-8 min-w-0 space-y-4">

          {/* Active bombs alert */}
          {club.bombs_enabled && bombCount > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-red-500/15 flex items-center gap-2">
                <span className="text-sm">💣</span>
                <p className="text-xs font-semibold text-red-400">
                  {bombCount} active bomb{bombCount > 1 ? 's' : ''} — members at risk of removal
                </p>
              </div>
              <div className="divide-y divide-red-500/10">
                {bombMembers.map(m => {
                  const deficit = m.deficit_surplus ? Number(m.deficit_surplus) : 0
                  const needed  = Math.ceil((Math.abs(deficit) / daysRemaining) + dailyQuota)
                  return (
                    <div key={m.member_id} className="flex items-center justify-between px-5 py-2.5 gap-4">
                      <span className="text-sm text-zinc-200 truncate">{m.trainer_name}</span>
                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <span className="text-xs text-red-400 tabular-nums">{fmt(deficit)} fans</span>
                        <div>
                          <p className="text-xs font-semibold text-red-300">
                            {m.bomb_days_remaining}d left
                          </p>
                          <p className="text-[10px] text-zinc-600">
                            needs {fmtLarge(needed)}/day
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Member table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                Members
              </p>
              <p className="text-[10px] text-zinc-700">
                {total} active · {daysRemaining > 0 ? `${daysRemaining}d left in ${monthName}` : `${monthName} complete`}
              </p>
            </div>

            {members.length === 0 ? (
              <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-16 text-center">
                <p className="text-sm text-zinc-600">No data yet — check back after the first scrape.</p>
              </div>
            ) : (
              <div className="bg-[#0d0d14] border border-white/5 rounded-xl overflow-hidden">
                <div className="hidden sm:grid px-5 py-2.5 border-b border-white/5
                                text-[10px] font-medium text-zinc-600 uppercase tracking-wide gap-4"
                  style={{ gridTemplateColumns: '2rem 1fr 6rem 1fr 8rem' }}>
                  <span>#</span>
                  <span>Member</span>
                  <span className="text-right">Fans</span>
                  <span>Progress</span>
                  <span className="text-right">Status</span>
                </div>
                <div className="divide-y divide-white/5">
                  {members.map((m, i) => (
                    <MemberRow
                      key={m.member_id}
                      member={m}
                      rank={i + 1}
                      bombsEnabled={club.bombs_enabled}
                      maxAbsSurplus={maxAbsSurplus}
                      daysRemaining={daysRemaining}
                      dailyQuota={dailyQuota}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// ── Member row ─────────────────────────────────────────────────
function MemberRow({ member, rank, bombsEnabled, maxAbsSurplus, daysRemaining, dailyQuota }: {
  member: PublicMember
  rank: number
  bombsEnabled: boolean
  maxAbsSurplus: number
  daysRemaining: number
  dailyQuota: number
}) {
  const surplus    = member.deficit_surplus != null ? Number(member.deficit_surplus) : null
  const fans       = member.cumulative_fans != null ? Number(member.cumulative_fans) : null
  const daysBehind = member.days_behind     != null ? Number(member.days_behind)     : 0
  const hasBomb    = member.has_bomb
  const bombDays   = member.bomb_days_remaining

  const isOnTrack = surplus !== null && surplus >= 0
  const isBehind  = surplus !== null && surplus < 0

  // Daily fans needed to recover by month end (extra on top of quota)
  const neededPerDay = isBehind && surplus !== null && daysRemaining > 0
    ? Math.ceil(dailyQuota + Math.abs(surplus) / daysRemaining)
    : null

  const accent = isOnTrack            ? 'bg-emerald-500'
    : hasBomb && bombsEnabled         ? 'bg-red-500'
    : isBehind                        ? 'bg-amber-500'
    : 'bg-zinc-700'

  const barFill = isOnTrack           ? 'bg-emerald-500'
    : hasBomb && bombsEnabled         ? 'bg-red-500'
    : 'bg-amber-500'

  const surplusColor = isOnTrack      ? 'text-emerald-400'
    : hasBomb && bombsEnabled         ? 'text-red-400'
    : 'text-amber-400'

  const surplusText = surplus === null ? '—'
    : surplus >= 0 ? `+${fmt(surplus)}` : fmt(surplus)

  const barWidth = surplus !== null
    ? Math.max(3, Math.round((Math.abs(surplus) / maxAbsSurplus) * 100))
    : 0

  // Top 3 rank colours
  const rankColor = rank === 1 ? 'text-yellow-400 font-bold'
    : rank === 2               ? 'text-slate-300 font-semibold'
    : rank === 3               ? 'text-amber-600 font-semibold'
    : 'text-zinc-600'

  const badge =
    surplus === null          ? <span className="text-[10px] text-zinc-600">no data</span>
    : hasBomb && bombsEnabled ? (
      <div className="text-right">
        <Pill color="red">💣 {bombDays}d left</Pill>
        {neededPerDay && <p className="text-[10px] text-zinc-600 mt-0.5">{fmtLarge(neededPerDay)}/day needed</p>}
      </div>
    )
    : isBehind ? (
      <div className="text-right">
        <Pill color="amber">{daysBehind}d behind</Pill>
        {neededPerDay && <p className="text-[10px] text-zinc-600 mt-0.5">{fmtLarge(neededPerDay)}/day needed</p>}
      </div>
    )
    : <Pill color="emerald">On track</Pill>

  return (
    <div className="relative group hover:bg-white/[0.02] transition-colors">
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full ${accent}`} />

      {/* Desktop */}
      <div className="hidden sm:grid items-center px-5 py-3 gap-4"
        style={{ gridTemplateColumns: '2rem 1fr 6rem 1fr 8rem' }}>
        <span className={`text-xs tabular-nums ${rankColor}`}>{rank}</span>
        <span className="text-sm font-medium text-zinc-100 truncate">{member.trainer_name}</span>
        <span className="text-xs text-zinc-500 tabular-nums text-right">
          {fans !== null ? fmtLarge(fans) : '—'}
        </span>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className={`h-full rounded-full ${barFill}`} style={{ width: `${barWidth}%` }} />
          </div>
          <span className={`text-xs font-semibold tabular-nums shrink-0 w-16 text-right ${surplusColor}`}>
            {surplusText}
          </span>
        </div>
        <div className="flex justify-end">{badge}</div>
      </div>

      {/* Mobile */}
      <div className="sm:hidden flex items-center gap-3 px-5 py-3.5">
        <span className={`text-[11px] w-5 shrink-0 tabular-nums ${rankColor}`}>{rank}</span>
        <span className="flex-1 min-w-0 text-sm font-medium text-zinc-100 truncate">
          {member.trainer_name}
        </span>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`text-xs font-semibold tabular-nums ${surplusColor}`}>{surplusText}</span>
          {badge}
        </div>
      </div>
    </div>
  )
}

// ── UI components ──────────────────────────────────────────────
function StatRow({ value, label, color, isText, sub }: {
  value: number | string; label: string
  color?: 'emerald' | 'amber' | 'red'; isText?: boolean
  sub?: { text: string; color: 'emerald' | 'red' }
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400', amber: 'text-amber-400', red: 'text-red-400',
  }
  const subColors: Record<string, string> = { emerald: 'text-emerald-500', red: 'text-red-500' }
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="text-right">
        <span className={`font-bold tabular-nums ${isText ? 'text-base' : 'text-xl'} ${color ? colors[color] : 'text-white'}`}>
          {value}
        </span>
        {sub && (
          <p className={`text-[10px] mt-0.5 ${subColors[sub.color]}`}>{sub.text}</p>
        )}
      </div>
    </div>
  )
}

function Pill({ children, color }: { children: React.ReactNode; color: 'emerald' | 'amber' | 'red' }) {
  const c = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber:   'bg-amber-500/10 text-amber-400',
    red:     'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${c[color]}`}>
      {children}
    </span>
  )
}

function Dot({ color, label }: { color: 'emerald' | 'amber' | 'red'; label: string }) {
  const c = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${c[color]}`} />
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number): string {
  const abs = Math.abs(n); const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${Math.round(abs / 1_000)}K`
  return String(n)
}
function fmtLarge(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`
  return String(n)
}
