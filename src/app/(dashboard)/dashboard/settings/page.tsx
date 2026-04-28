import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import ClubDetail from './ClubDetail'
import AddClubButton from './AddClubModal'
import Link from 'next/link'

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
}

export type QuotaReq = {
  id: string
  effective_date: string
  daily_quota: string
  set_by: string | null
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>
}) {
  const { club: selectedId } = await searchParams

  const session = await auth()
  const guildIds = session?.adminGuildIds ?? []

  const clubs = await query<Club>(`
    SELECT club_id, club_name, daily_quota::text, quota_period,
           is_active, bombs_enabled, bomb_trigger_days, bomb_countdown_days,
           timezone, scrape_time::text,
           report_channel_id::text, alert_channel_id::text,
           monthly_info_channel_id::text,
           scrape_url, circle_id, guild_id::text
    FROM clubs WHERE guild_id::text = ANY($1::text[]) ORDER BY club_name
  `, [guildIds]).catch(() => [])

  const selected = clubs.find(c => c.club_id === selectedId) ?? clubs[0]

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
      <div>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Club configuration and management</p>
      </div>

      <div className="flex flex-col md:flex-row gap-5 min-h-[600px]">
        {/* Club list */}
        <div className="w-full md:w-48 shrink-0">
          <div className="space-y-0.5">
            {clubs.map(c => (
              <Link
                key={c.club_id}
                href={`?club=${c.club_id}`}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selected?.club_id === c.club_id
                    ? 'bg-violet-600/15 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                <span className="truncate text-sm">{c.club_name}</span>
              </Link>
            ))}
          </div>
          <AddClubButton />
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <ClubDetail key={selected.club_id} club={selected} quotaHistory={quotaHistory} />
          ) : (
            <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-8 text-xs text-zinc-600 text-center">
              No clubs found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
