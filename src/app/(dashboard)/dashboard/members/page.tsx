import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { MemberToggle, AddMemberButton } from './MemberActions'
import MemberSearch from './MemberSearch'
import { resolveActiveClub } from '@/lib/active-club'
import { Suspense } from 'react'

type Member = {
  member_id: string
  trainer_name: string
  trainer_id: string
  club_name: string
  club_id: string
  is_active: boolean
  join_date: string | null
  last_seen: string | null
  deficit_surplus: string | null
  cumulative_fans: string | null
  days_behind: string | null
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; search?: string }>
}) {
  const { filter, search } = await searchParams

  const session = await auth()
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  if (!active) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-white">Members</h1>
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-10 text-center text-xs text-zinc-600">
          No club selected. Add a club or pick one from the switcher above.
        </div>
      </div>
    )
  }

  // Everything on this page is scoped to the active club chosen in the header.
  const searchFilter = search ? 'AND m.trainer_name ILIKE $2' : ''
  const memberParams = search ? [active.club_id, `%${search}%`] : [active.club_id]

  const members = await query<Member>(`
    SELECT
      m.member_id, m.trainer_name, m.trainer_id, c.club_name, c.club_id,
      m.is_active, m.join_date::text, m.last_seen::text,
      lat.deficit_surplus::text, lat.cumulative_fans::text, lat.days_behind::text
    FROM members m
    JOIN clubs c ON c.club_id = m.club_id
    LEFT JOIN LATERAL (
      SELECT deficit_surplus, cumulative_fans, days_behind
      FROM quota_history WHERE member_id = m.member_id ORDER BY date DESC LIMIT 1
    ) lat ON true
    WHERE m.club_id = $1
      ${filter === 'active'   ? 'AND m.is_active = true'  : ''}
      ${filter === 'inactive' ? 'AND m.is_active = false' : ''}
      ${searchFilter}
    ORDER BY m.is_active DESC, m.trainer_name
  `, memberParams).catch(() => [])

  const counts = await query<{ filter: string; c: string }>(`
    SELECT CASE WHEN m.is_active THEN 'active' ELSE 'inactive' END AS filter, COUNT(*)::text AS c
    FROM members m
    WHERE m.club_id = $1
    GROUP BY m.is_active
  `, [active.club_id]).catch(() => [])

  const total     = counts.reduce((a, r) => a + Number(r.c), 0)
  const activeN   = counts.find(r => r.filter === 'active')?.c  ?? '0'
  const inactiveN = counts.find(r => r.filter === 'inactive')?.c ?? '0'

  const tabs = [
    { label: 'All',      value: undefined,    count: String(total) },
    { label: 'Active',   value: 'active',     count: activeN },
    { label: 'Inactive', value: 'inactive',   count: inactiveN },
  ]

  function tabHref(tabValue?: string) {
    const p = new URLSearchParams()
    if (tabValue) p.set('filter', tabValue)
    if (search)   p.set('search', search)
    return `?${p.toString()}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Members</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{members.length} shown</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <Suspense>
            <MemberSearch />
          </Suspense>

          <AddMemberButton clubs={[active]} />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center border-b border-white/5">
        {tabs.map(tab => (
          <Link key={tab.label} href={tabHref(tab.value)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              (filter ?? undefined) === tab.value ? 'border-violet-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            {tab.label} <span className="text-zinc-600">{tab.count}</span>
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Trainer</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Club</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Status</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Last seen</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Fans</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Surplus</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Days behind</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {members.map(m => {
              const surplus = m.deficit_surplus !== null ? Number(m.deficit_surplus) : null
              return (
                <tr key={m.member_id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/members/${m.member_id}`} className="group">
                      <p className="text-xs font-medium text-white group-hover:text-violet-300 transition-colors">{m.trainer_name}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{m.trainer_id}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-400">{m.club_name}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-medium ${
                      m.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-zinc-500'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${m.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                      {m.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-400">
                    {m.last_seen ? new Date(m.last_seen).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-300">
                    {m.cumulative_fans ? formatFans(Number(m.cumulative_fans)) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {surplus !== null
                      ? <span className={`text-xs font-medium ${surplus >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{surplus >= 0 ? '+' : ''}{formatFans(surplus)}</span>
                      : <span className="text-xs text-zinc-600">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    {m.days_behind !== null
                      ? <span className={`text-xs ${Number(m.days_behind) > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>{m.days_behind}d</span>
                      : <span className="text-xs text-zinc-600">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <MemberToggle memberId={m.member_id} isActive={m.is_active} />
                  </td>
                </tr>
              )
            })}
            {members.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-xs text-zinc-600 text-center">
                {search ? `No members matching "${search}"` : 'No members found'}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

function formatFans(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`
  return String(n)
}
