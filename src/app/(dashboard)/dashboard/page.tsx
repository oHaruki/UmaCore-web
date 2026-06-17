import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isClubAdmin, effectiveAdminGuildIds } from '@/lib/guild-check'
import { resolveActiveClub } from '@/lib/active-club'
import { getBotGuilds } from '@/lib/bot-guilds'
import ClubCardLink from './ClubCardLink'
import ClubEditors from './settings/ClubEditors'
import GuildManagers from './GuildManagers'
import AddClubButton from './settings/AddClubModal'

type ClubStat = {
  club_id: string; club_name: string; daily_quota: string
  quota_period: string; is_active: boolean
  active_count: string; on_track: string; behind: string
}
type RankPoint = {
  club_id: string; club_name: string; date: string; club_rank: string
}

export default async function DashboardPage() {
  const session = await auth()
  const { active, clubs: accessibleClubs } = session
    ? await resolveActiveClub(session)
    : { active: null, clubs: [] }
  const clubIds = accessibleClubs.map(c => c.club_id)
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
    query<ClubStat>(`
      SELECT c.club_id, c.club_name, c.daily_quota::text, c.quota_period, c.is_active,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus IS NOT NULL)::text AS active_count,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus >= 0)::text AS on_track,
        COUNT(m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus < 0)::text AS behind
      FROM clubs c
      LEFT JOIN members m ON m.club_id = c.club_id
      LEFT JOIN LATERAL (
        SELECT deficit_surplus FROM quota_history WHERE member_id = m.member_id ORDER BY date DESC LIMIT 1
      ) lat ON true
      WHERE c.club_id::text = ANY($1::text[])
      GROUP BY c.club_id ORDER BY c.club_name
    `, [clubIds]).catch(() => []),

    query<RankPoint>(`
      SELECT crh.club_id::text, c.club_name, crh.date::text, crh.club_rank::text
      FROM club_rank_history crh
      JOIN clubs c ON c.club_id = crh.club_id
      WHERE crh.date >= CURRENT_DATE - INTERVAL '30 days'
        AND c.club_id::text = ANY($1::text[])
      ORDER BY c.club_name, crh.date ASC
    `, [clubIds]).catch(() => []),
  ])

  const totals = clubStats.reduce(
    (a, c) => ({ members: a.members + Number(c.active_count), onTrack: a.onTrack + Number(c.on_track), behind: a.behind + Number(c.behind) }),
    { members: 0, onTrack: 0, behind: 0 }
  )

  // Group rank history by club
  const rankByClub = rankHistory.reduce<Record<string, RankPoint[]>>((acc, r) => {
    (acc[r.club_id] ??= []).push(r)
    return acc
  }, {})

  const BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1467295225184784488&permissions=83968&integration_type=0&scope=bot+applications.commands'

  if (clubStats.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Overview</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <span className="text-xs text-zinc-600">{session?.user?.name}</span>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
            <svg className="w-7 h-7 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-white mb-2">Welcome to UmaCore</h2>
          <p className="text-sm text-zinc-500 max-w-sm mb-8">
            You don&apos;t have any clubs connected yet. Invite the Discord bot to your server to get started.
          </p>

          <a
            href={BOT_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors mb-10"
          >
            Invite Bot to Discord
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <div className="flex flex-col sm:flex-row gap-4 text-left max-w-lg w-full">
            {[
              { step: '1', title: 'Invite the bot', desc: 'Add the UmaCore bot to your Discord server using the button above.' },
              { step: '2', title: 'Set up a club', desc: 'Use bot commands in Discord to create and configure your Uma Musume club.' },
              { step: '3', title: 'Track your members', desc: 'Member data and quota stats will appear here automatically.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex-1 bg-[#0d0d14] border border-white/5 rounded-lg p-4">
                <div className="w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-400 text-xs font-semibold flex items-center justify-center mb-3">{step}</div>
                <p className="text-sm font-medium text-white mb-1">{title}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Clubs Overview</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Select a club to manage it</p>
        </div>
        <AddClubButton adminGuilds={addableGuilds} />
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active members', value: totals.members },
          { label: 'On track',       value: totals.onTrack,  color: 'text-emerald-400' },
          { label: 'Behind quota',   value: totals.behind,   color: totals.behind > 0 ? 'text-amber-400' : undefined },
          { label: 'Active clubs',   value: clubStats.filter(c => c.is_active).length },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0d0d14] border border-white/5 rounded-lg p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`mt-1.5 text-2xl font-semibold ${color ?? 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Club cards — pick one to manage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clubStats.map(club => {
            const total   = Number(club.active_count)
            const onTrack = Number(club.on_track)
            const pct     = total > 0 ? Math.round((onTrack / total) * 100) : 0
            const rankData = rankByClub[club.club_id] ?? []
            const latestRank = rankData[rankData.length - 1]?.club_rank
            const isActiveClub = club.club_id === active?.club_id

            return (
              <ClubCardLink key={club.club_id} clubId={club.club_id}>
              <div className={`bg-[#0d0d14] border rounded-lg p-5 transition-colors ${
                isActiveClub ? 'border-violet-500/60 ring-1 ring-violet-500/30' : 'border-white/5 hover:border-white/15'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${club.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <p className="text-sm font-medium text-white">{club.club_name}</p>
                    <span className="text-xs text-zinc-600 capitalize">{club.quota_period}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {latestRank && (
                      <span className="text-xs text-zinc-500">Rank #{latestRank}</span>
                    )}
                    <span className="text-xs text-zinc-500">{formatFans(Number(club.daily_quota))} / day</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Members</p><p className="text-sm font-medium text-white">{club.active_count}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">On track</p><p className="text-sm font-medium text-emerald-400">{club.on_track}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Behind</p><p className="text-sm font-medium text-amber-400">{club.behind}</p></div>
                </div>

                {/* Quota health bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
                    <span>Quota health</span><span>{pct}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Rank sparkline */}
                {rankData.length >= 2 && (
                  <RankSparkline data={rankData.map(r => Number(r.club_rank))} />
                )}
              </div>
              </ClubCardLink>
            )
          })}
      </div>

      {/* Editors for the selected club — admin only */}
      {canManageEditors && active && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">
            Editor roles for <span className="text-zinc-300">{active.club_name}</span>
          </p>
          <ClubEditors clubId={active.club_id} />
        </div>
      )}

      {/* Server-wide manager roles — Discord admins only */}
      {isGuildDiscordAdmin && active?.guild_id && (
        <GuildManagers guildId={active.guild_id} />
      )}
    </div>
  )
}

function RankSparkline({ data }: { data: number[] }) {
  const W = 200, H = 28
  const sorted = [...data].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1
  const filtered = data.filter(v => v <= median * 5)
  const min = Math.min(...filtered), max = Math.max(...filtered)
  const range = max - min || 1
  // Rank: lower = better, so invert Y
  const xOf = (i: number) => (i / Math.max(filtered.length - 1, 1)) * W
  const yOf = (v: number) => H - ((max - v) / range) * H
  const points = filtered.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')

  return (
    <div>
      <p className="text-[10px] text-zinc-600 mb-1">Club rank (30d) — lower is better</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 28 }}>
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={xOf(filtered.length - 1)} cy={yOf(filtered[filtered.length - 1])} r="2.5" fill="#6366f1" />
      </svg>
    </div>
  )
}

function formatFans(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`
  return String(n)
}
