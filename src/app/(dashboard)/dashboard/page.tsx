import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ArrowLeftRight, Bomb, TrendingDown, ExternalLink, Bot, SlidersHorizontal, UsersRound } from 'lucide-react'
import { EFFECTIVE_QUOTA_SQL } from '@/lib/quota'
import { isClubAdmin, effectiveAdminGuildIds } from '@/lib/guild-check'
import { resolveActiveClub } from '@/lib/active-club'
import { getBotGuilds } from '@/lib/bot-guilds'
import { formatFans, nameHue, initials } from '@/lib/format'
import { monthLabel } from '@/lib/month'
import { PageHeader, Panel, Stat, StatStrip, SplitMeter, Chip } from '@/components/dash/ui'
import ClubCardLink from './ClubCardLink'
import ClubEditors from './settings/ClubEditors'
import GuildManagers from './GuildManagers'
import AddClubButton from './settings/AddClubModal'

type ClubStat = {
  club_id: string; club_name: string; daily_quota: string
  quota_period: string; is_active: boolean
  active_count: string; on_track: string; behind: string
  bombs: string; transfers: string
  month: string | null
}
type RankPoint = {
  club_id: string; club_name: string; date: string; club_rank: string
}

const BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1467295225184784488&permissions=83968&integration_type=0&scope=bot+applications.commands'

export default async function DashboardPage() {
  const session = await auth()
  const { active, clubs: accessibleClubs } = session
    ? await resolveActiveClub(session)
    : { active: null, clubs: [] }
  const clubIds = accessibleClubs.map(c => c.club_id)

  // Someone who manages no clubs but has linked a trainer came to see their own progress.
  if (!accessibleClubs.length && session && /^\d+$/.test(session.user.id)) {
    const linked = await query(
      'SELECT 1 FROM user_links WHERE discord_user_id = $1::bigint', [session.user.id]
    ).catch(() => [])
    if (linked.length) redirect('/dashboard/me')
  }
  const canManageEditors = session && active ? await isClubAdmin(session, active.club_id) : false
  // Manager-role assignment is Discord-admin-only (no manager self-escalation).
  const isGuildDiscordAdmin = !!(active?.guild_id && session?.adminGuildIds?.includes(active.guild_id))
  // Servers you can add a club to: ones you admin/manage AND the bot is in.
  // Names come from the bot (manager-only guild names aren't in the session).
  const effAdminGuildIds = session ? await effectiveAdminGuildIds(session) : []
  const botGuilds = await getBotGuilds()
  const addableGuilds = botGuilds
    ? botGuilds.filter(g => effAdminGuildIds.includes(g.id))
    : (session?.adminGuilds ?? []).filter(g => effAdminGuildIds.includes(g.id))

  const [clubStats, rankHistory] = await Promise.all([
    // Counts are for each club's current quota month (the month of its latest check),
    // so last month's numbers never mix in.
    query<ClubStat>(`
      WITH cm AS (
        SELECT club_id, date_trunc('month', MAX(date))::date AS start
        FROM quota_history WHERE club_id::text = ANY($1::text[]) GROUP BY club_id
      )
      SELECT c.club_id, c.club_name, ${EFFECTIVE_QUOTA_SQL}::text AS daily_quota, c.quota_period, c.is_active,
        to_char(MAX(cm.start), 'YYYY-MM') AS month,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus IS NOT NULL)::text AS active_count,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus >= 0)::text AS on_track,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus < 0)::text AS behind,
        (SELECT COUNT(*) FROM bombs b WHERE b.club_id = c.club_id AND b.is_active)::text AS bombs,
        (SELECT COUNT(*) FROM transfer_requests tr WHERE tr.to_club_id = c.club_id AND tr.status = 'pending')::text AS transfers
      FROM clubs c
      LEFT JOIN cm ON cm.club_id = c.club_id
      LEFT JOIN members m ON m.club_id = c.club_id
      LEFT JOIN LATERAL (
        SELECT deficit_surplus FROM quota_history
        WHERE member_id = m.member_id AND club_id = c.club_id AND date >= cm.start
        ORDER BY date DESC LIMIT 1
      ) lat ON true
      WHERE c.club_id::text = ANY($1::text[])
      GROUP BY c.club_id ORDER BY c.club_name
    `, [clubIds]).catch(() => []),

    query<RankPoint>(`
      SELECT crh.club_id::text, c.club_name, crh.date::text, crh.club_rank::text
      FROM club_rank_history crh
      JOIN clubs c ON c.club_id = crh.club_id
      JOIN (
        SELECT club_id, date_trunc('month', MAX(date))::date AS start
        FROM quota_history WHERE club_id::text = ANY($1::text[]) GROUP BY club_id
      ) cm ON cm.club_id = crh.club_id
      WHERE crh.date >= cm.start
        AND c.club_id::text = ANY($1::text[])
      ORDER BY c.club_name, crh.date ASC
    `, [clubIds]).catch(() => []),
  ])

  const firstName = session?.user?.name?.split(/\s+/)[0] ?? null

  if (clubStats.length === 0) {
    return <Welcome firstName={firstName} />
  }

  const totals = clubStats.reduce(
    (a, c) => ({ members: a.members + Number(c.active_count), onTrack: a.onTrack + Number(c.on_track), behind: a.behind + Number(c.behind) }),
    { members: 0, onTrack: 0, behind: 0 }
  )
  const onTrackPct = totals.members ? Math.round((totals.onTrack / totals.members) * 100) : 0

  const rankByClub = rankHistory.reduce<Record<string, RankPoint[]>>((acc, r) => {
    (acc[r.club_id] ??= []).push(r)
    return acc
  }, {})

  // Things a leader can act on, most urgent first.
  const attention = [
    ...clubStats.filter(c => Number(c.bombs) > 0).map(c => ({
      key: `b-${c.club_id}`, club: c, href: '/dashboard/bombs', icon: Bomb, tone: 'bad' as const,
      text: <><b className="font-semibold text-fg">{c.bombs} active bomb{Number(c.bombs) === 1 ? '' : 's'}</b> in {c.club_name}</>,
    })),
    ...clubStats.filter(c => Number(c.transfers) > 0).map(c => ({
      key: `t-${c.club_id}`, club: c, href: '/dashboard/transfers', icon: ArrowLeftRight, tone: 'brand' as const,
      text: <><b className="font-semibold text-fg">{c.transfers} waiting</b> to transfer into {c.club_name}</>,
    })),
    ...clubStats.filter(c => c.is_active && Number(c.behind) > 0).map(c => ({
      key: `w-${c.club_id}`, club: c, href: '/dashboard/clubs', icon: TrendingDown, tone: 'warn' as const,
      text: <><b className="font-semibold text-fg">{c.behind} behind quota</b> in {c.club_name}</>,
    })),
  ]

  const toneIcon = { bad: 'bg-bad/14 text-bad', brand: 'bg-brand/14 text-brand', warn: 'bg-warn/12 text-warn' }

  return (
    <div className="rise space-y-8">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Overview'}
        description={`${clubStats.length} club${clubStats.length === 1 ? '' : 's'} you manage. Pick one to open it.`}
        actions={<AddClubButton adminGuilds={addableGuilds} />}
      />

      <StatStrip>
        <Stat label="Members tracked" value={totals.members} />
        <Stat
          label="On track"
          value={`${onTrackPct}%`}
          tone={totals.members ? (onTrackPct >= 80 ? 'good' : 'warn') : 'neutral'}
          hint={`${totals.onTrack} of ${totals.members}`}
        />
        <Stat label="Behind quota" value={totals.behind} tone={totals.behind > 0 ? 'warn' : 'neutral'} />
        <Stat label="Active clubs" value={clubStats.filter(c => c.is_active).length} hint={`of ${clubStats.length}`} />
      </StatStrip>

      {attention.length > 0 && (
        <Panel title="Needs attention" description="Jump straight to the page that sorts it." flush>
          <ul className="divide-y divide-line border-t border-line">
            {attention.slice(0, 6).map(a => (
              <li key={a.key}>
                <ClubCardLink clubId={a.club.club_id} href={a.href} className="rounded-none">
                  <div className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${toneIcon[a.tone]}`}>
                      <a.icon size={16} strokeWidth={1.75} />
                    </span>
                    <p className="min-w-0 flex-1 text-sm text-fg-muted">{a.text}</p>
                    <ArrowRight size={16} strokeWidth={1.75} className="text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                  </div>
                </ClubCardLink>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-fg">Your clubs</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {clubStats.map(club => {
            const total = Number(club.active_count)
            const onTrack = Number(club.on_track)
            const behind = Number(club.behind)
            const pct = total > 0 ? Math.round((onTrack / total) * 100) : null
            const ranks = cleanRanks((rankByClub[club.club_id] ?? []).map(r => Number(r.club_rank)))
            const latestRank = ranks[ranks.length - 1]
            const rankDelta = ranks.length >= 2 ? ranks[0] - latestRank : 0
            const isCurrent = club.club_id === active?.club_id
            const hue = nameHue(club.club_name)

            return (
              <ClubCardLink key={club.club_id} clubId={club.club_id} label={`Open ${club.club_name}`}>
                <article
                  className="panel group h-full p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
                  style={{ backgroundImage: `radial-gradient(120% 90% at 0% 0%, oklch(0.32 0.06 ${hue} / 22%), transparent 55%)` }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-[30%] text-[13px] font-semibold"
                      style={{ background: `oklch(0.32 0.05 ${hue})`, color: `oklch(0.92 0.05 ${hue})` }}
                    >
                      {initials(club.club_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-fg">{club.club_name}</h3>
                        {isCurrent && <Chip tone="brand">Selected</Chip>}
                        {!club.is_active && <Chip>Inactive</Chip>}
                      </div>
                      <p className="num mt-0.5 text-[13px] text-fg-subtle">
                        {formatFans(Number(club.daily_quota))} per {periodWord(club.quota_period)}
                        {latestRank ? <> · rank #{latestRank.toLocaleString('en-US')}</> : null}
                      </p>
                    </div>
                    <ArrowRight size={18} strokeWidth={1.75} className="mt-1 text-fg-subtle transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-fg" />
                  </div>

                  <div className="mt-6 flex items-end justify-between gap-4">
                    <div>
                      <p className="num font-display text-[34px] font-semibold leading-none tracking-[-0.02em] text-fg">
                        {pct === null ? '–' : `${pct}%`}
                      </p>
                      <p className="mt-1.5 text-[13px] text-fg-muted">
                        {total
                          ? <>on track in {club.month ? monthLabel(club.month, { month: 'long' }) : 'this month'} · <span className="text-good">{onTrack}</span> of {total}</>
                          : 'No quota data yet'}
                      </p>
                    </div>
                    {ranks.length >= 2 && (
                      <div className="w-36 text-right">
                        <Sparkline values={ranks} />
                        <p className={`num mt-1 text-xs ${rankDelta > 0 ? 'text-good' : rankDelta < 0 ? 'text-warn' : 'text-fg-subtle'}`}>
                          {rankDelta > 0 ? `Up ${rankDelta}` : rankDelta < 0 ? `Down ${-rankDelta}` : 'No change'} this month
                        </p>
                      </div>
                    )}
                  </div>

                  <SplitMeter good={onTrack} bad={behind} className="mt-4" />

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {behind > 0 && <Chip tone="warn">{behind} behind</Chip>}
                    {Number(club.bombs) > 0 && <Chip tone="bad">💣 {club.bombs} active</Chip>}
                    {Number(club.transfers) > 0 && <Chip tone="brand">{club.transfers} transfer{Number(club.transfers) === 1 ? '' : 's'} waiting</Chip>}
                    {behind === 0 && Number(club.bombs) === 0 && Number(club.transfers) === 0 && total > 0 && (
                      <Chip tone="good">Everyone on track</Chip>
                    )}
                  </div>
                </article>
              </ClubCardLink>
            )
          })}
        </div>
      </section>

      {(canManageEditors || isGuildDiscordAdmin) && active && (
        <section className="space-y-3">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Access for {active.club_name}</h2>
            <p className="mt-0.5 text-[13px] text-fg-subtle">Who besides Discord admins can manage this club.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {canManageEditors && <ClubEditors clubId={active.club_id} />}
            {isGuildDiscordAdmin && active.guild_id && <GuildManagers guildId={active.guild_id} />}
          </div>
        </section>
      )}
    </div>
  )
}

function Welcome({ firstName }: { firstName: string | null }) {
  const steps = [
    { icon: Bot, title: 'Invite the bot', body: 'Add UmaCore to your Discord server with the button above.' },
    { icon: SlidersHorizontal, title: 'Set up your club', body: 'Run /add_club in Discord, or add it here once the bot has joined.' },
    { icon: UsersRound, title: 'Watch the numbers come in', body: 'Member quota progress shows up here after the first daily check.' },
  ]
  return (
    <div className="rise grid items-center gap-10 py-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="font-display text-[34px] md:text-[44px] font-semibold leading-[1.05] tracking-[-0.025em] text-fg text-balance">
            {firstName ? `Hi ${firstName}, let's get your club tracked` : "Let's get your club tracked"}
          </h1>
          <p className="max-w-[52ch] text-[15px] leading-relaxed text-fg-muted">
            You don&apos;t manage any clubs yet. Invite the bot to your server and your club&apos;s quota board fills itself in.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={BOT_INVITE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Invite the bot
            <ExternalLink size={14} strokeWidth={1.75} />
          </a>
          <Link href="/dashboard/me" className="btn btn-secondary">I&apos;m a member</Link>
        </div>
        <ol className="space-y-4">
          {steps.map(s => (
            <li key={s.title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand">
                <s.icon size={18} strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-medium text-fg">{s.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[13px] text-fg-subtle">
          Just here for your own progress? Link your trainer with <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-soft">/link_trainer</code> in Discord, then open My trainer.
        </p>
      </div>
      <div className="relative mx-auto hidden aspect-[400/460] w-full max-w-sm lg:block">
        <Image src="/images/sakura_mascot_v2.webp" alt="Sakura Chiyono O, the UmaCore mascot" fill sizes="384px" className="object-contain" priority />
      </div>
    </div>
  )
}

/** Drop rank spikes (missed scrapes report huge ranks) so the line shows the real trend. */
function cleanRanks(ranks: number[]) {
  if (!ranks.length) return ranks
  const sorted = [...ranks].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1
  return ranks.filter(v => v <= median * 5)
}

function Sparkline({ values }: { values: number[] }) {
  const W = 144, H = 32
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  // Lower rank is better, so it's drawn higher.
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * (W - 4) + 2, 2 + ((v - min) / range) * (H - 4)])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ml-auto h-8 w-36" aria-hidden>
      <path d={d} fill="none" stroke="var(--uc-brand)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.75" fill="var(--uc-brand)" />
    </svg>
  )
}

function periodWord(p: string) {
  return p === 'weekly' ? 'week' : p === 'biweekly' || p === 'bi-weekly' ? '2 weeks' : 'day'
}
