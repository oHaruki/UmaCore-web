import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import { effectiveAdminGuildIds } from '@/lib/guild-check'
import { getBotGuilds } from '@/lib/bot-guilds'
import ClubDetail from './ClubDetail'
import AddClubButton from './AddClubModal'

export type Club = {
  club_id: string
  club_name: string
  daily_quota: string
  quota_period: string
  is_active: boolean
  bombs_enabled: boolean
  bomb_trigger_days: number
  bomb_countdown_days: number
  timezone: string
  scrape_time: string
  report_channel_id: string | null
  alert_channel_id: string | null
  monthly_info_channel_id: string | null
  scrape_url: string | null
  circle_id: string | null
  guild_id: string | null
  public_enabled: boolean
  public_slug: string | null
  image_report_enabled: boolean
  live_board_channel_id: string | null
}

export type QuotaReq = {
  id: string
  effective_date: string
  daily_quota: string
  set_by: string | null
}

export default async function SettingsPage() {
  const session = await auth()
  const effAdminGuildIds = session ? await effectiveAdminGuildIds(session) : []
  const botGuilds = await getBotGuilds()
  const addableGuilds = botGuilds
    ? botGuilds.filter(g => effAdminGuildIds.includes(g.id))
    : (session?.adminGuilds ?? []).filter(g => effAdminGuildIds.includes(g.id))
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  const clubRows = active
    ? await query<Club>(`
        SELECT club_id, club_name, daily_quota::text, quota_period,
               is_active, bombs_enabled, bomb_trigger_days, bomb_countdown_days,
               timezone, scrape_time::text,
               report_channel_id::text, alert_channel_id::text,
               monthly_info_channel_id::text,
               scrape_url, circle_id, guild_id::text,
               public_enabled, public_slug, image_report_enabled,
               live_board_channel_id::text
        FROM clubs WHERE club_id = $1
      `, [active.club_id]).catch(() => [])
    : []

  const selected = clubRows[0]

  const quotaHistory = selected
    ? await query<QuotaReq>(`
        SELECT id::text, effective_date::text, daily_quota::text, set_by
        FROM quota_requirements
        WHERE club_id = $1
        ORDER BY effective_date DESC LIMIT 20
      `, [selected.club_id]).catch(() => [])
    : []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">
            Settings{selected ? ` · ${selected.club_name}` : ''}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Configuration for the selected club</p>
        </div>
        <AddClubButton adminGuilds={addableGuilds} />
      </div>

      {selected ? (
        <ClubDetail key={selected.club_id} club={selected} quotaHistory={quotaHistory} />
      ) : (
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-8 text-xs text-zinc-600 text-center">
          No club selected. Add a club or pick one from the switcher above.
        </div>
      )}
    </div>
  )
}
