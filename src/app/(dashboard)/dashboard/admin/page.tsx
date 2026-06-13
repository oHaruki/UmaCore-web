import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { query, queryOne } from '@/lib/db'
import LogsPanel from './LogsPanel'

const OWNER_ID = '139769063948681217'

export default async function AdminPage() {
  const session = await auth()
  if (!session || session.user.id !== OWNER_ID) redirect('/dashboard')

  const [stats, topGuilds] = await Promise.all([
    queryOne<{
      total_clubs: number
      active_clubs: number
      total_members: number
      active_members: number
      image_enabled: number
      guilds: number
    }>(`
      SELECT
        (SELECT COUNT(*)                              FROM clubs)                                    AS total_clubs,
        (SELECT COUNT(*) FILTER (WHERE is_active)    FROM clubs)                                    AS active_clubs,
        (SELECT COUNT(*) FILTER (WHERE image_report_enabled) FROM clubs)                            AS image_enabled,
        (SELECT COUNT(DISTINCT guild_id)             FROM clubs)                                    AS guilds,
        (SELECT COUNT(*)                             FROM members)                                  AS total_members,
        (SELECT COUNT(*) FILTER (WHERE is_active)    FROM members)                                  AS active_members
    `),
    query<{ guild_id: string; clubs: number; members: number }>(`
      SELECT
        c.guild_id::text,
        COUNT(DISTINCT c.club_id)                                   AS clubs,
        COUNT(m.member_id) FILTER (WHERE m.is_active)               AS members
      FROM clubs c
      LEFT JOIN members m ON m.club_id = c.club_id
      GROUP BY c.guild_id
      ORDER BY COUNT(m.member_id) FILTER (WHERE m.is_active) DESC
      LIMIT 10
    `),
  ])

  const s = stats!

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <p className="text-zinc-500 text-sm mt-1">Owner-only.</p>
      </div>

      {/* Stats grid */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Guilds',          value: s.guilds },
            { label: 'Total clubs',     value: s.total_clubs },
            { label: 'Active clubs',    value: s.active_clubs },
            { label: 'Total members',   value: s.total_members },
            { label: 'Active members',  value: s.active_members },
            { label: 'Image reports',   value: s.image_enabled },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-4">
              <p className="text-xs text-zinc-500 mb-1">{label}</p>
              <p className="text-2xl font-bold text-white">{Number(value).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top guilds by member count */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Top 10 guilds by active members
        </h2>
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Guild ID</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Clubs</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Active members</th>
              </tr>
            </thead>
            <tbody>
              {topGuilds.map((g, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{g.guild_id}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{g.clubs}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{Number(g.members).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Live logs */}
      <LogsPanel />
    </div>
  )
}
