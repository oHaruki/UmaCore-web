import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { Suspense } from 'react'
import { UserPlus } from 'lucide-react'
import { MemberToggle, AddMemberButton } from './MemberActions'
import MemberSearch from './MemberSearch'
import { resolveActiveClub } from '@/lib/active-club'
import { formatDelta, formatFans, timeAgo } from '@/lib/format'
import { monthStart, monthLabel, inMonthSql } from '@/lib/month'
import { PageHeader, Chip, Avatar, EmptyState, NoClub } from '@/components/dash/ui'
import LinkTabs from '@/components/dash/LinkTabs'

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

  if (!active) return <NoClub title="Members" />

  // Everything on this page is scoped to the active club, and the quota columns to
  // its current month, so members who stopped playing don't show last month's numbers.
  const [current] = await query<{ month: string | null }>(
    `SELECT to_char(MAX(date), 'YYYY-MM') AS month FROM quota_history WHERE club_id = $1`,
    [active.club_id]
  ).catch(() => [])
  const month = current?.month ?? null
  const searchFilter = search ? 'AND m.trainer_name ILIKE $3' : ''
  const memberParams = search
    ? [active.club_id, month ? monthStart(month) : null, `%${search}%`]
    : [active.club_id, month ? monthStart(month) : null]

  const members = await query<Member>(`
    SELECT
      m.member_id, m.trainer_name, m.trainer_id, c.club_name, c.club_id,
      m.is_active, m.join_date::text, m.last_seen::text,
      lat.deficit_surplus::text, lat.cumulative_fans::text, lat.days_behind::text
    FROM members m
    JOIN clubs c ON c.club_id = m.club_id
    LEFT JOIN LATERAL (
      SELECT deficit_surplus, cumulative_fans, days_behind
      FROM quota_history
      WHERE member_id = m.member_id AND club_id = $1 AND ${inMonthSql('date', '$2')}
      ORDER BY date DESC LIMIT 1
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

  function tabHref(tabValue?: string) {
    const p = new URLSearchParams()
    if (tabValue) p.set('filter', tabValue)
    if (search)   p.set('search', search)
    const qs = p.toString()
    return qs ? `?${qs}` : '/dashboard/members'
  }

  const tabs = [
    { label: 'All',      href: tabHref(),           count: total,             current: !filter },
    { label: 'Active',   href: tabHref('active'),   count: Number(activeN),   current: filter === 'active' },
    { label: 'Inactive', href: tabHref('inactive'), count: Number(inactiveN), current: filter === 'inactive' },
  ]

  const maxAbs = Math.max(1, ...members.map(m => Math.abs(Number(m.deficit_surplus ?? 0))))

  return (
    <div className="rise space-y-6">
      <PageHeader
        title="Members"
        description={`Everyone the bot has seen in ${active.club_name}. Fans and surplus are for ${month ? monthLabel(month) : 'the current month'}; deactivated members stop counting toward quota.`}
        actions={<AddMemberButton clubs={[active]} />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <LinkTabs tabs={tabs} id="members" />
        <Suspense>
          <MemberSearch />
        </Suspense>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead>
              <tr>
                <th>Trainer</th>
                <th>Status</th>
                <th className="hidden lg:table-cell">Last seen</th>
                <th className="text-right">Fans{month ? ` (${monthLabel(month, { month: 'short' })})` : ''}</th>
                <th>Surplus</th>
                <th className="hidden md:table-cell">Days behind</th>
                <th className="w-px"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const surplus = m.deficit_surplus !== null ? Number(m.deficit_surplus) : null
                const share = surplus !== null ? Math.min(1, Math.abs(surplus) / maxAbs) : 0
                return (
                  <tr key={m.member_id} className="group">
                    <td>
                      <Link href={`/dashboard/members/${m.member_id}`} className="flex items-center gap-3">
                        <Avatar name={m.trainer_name} size={32} className={m.is_active ? '' : 'opacity-50'} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg-soft transition-colors group-hover:text-fg">{m.trainer_name}</span>
                          <span className="num block text-xs text-fg-subtle">{m.trainer_id}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Chip tone={m.is_active ? 'good' : 'neutral'}>{m.is_active ? 'Active' : 'Inactive'}</Chip>
                    </td>
                    <td className="hidden text-fg-muted lg:table-cell" title={m.last_seen ? new Date(m.last_seen).toLocaleString() : undefined}>
                      {timeAgo(m.last_seen) ?? '–'}
                    </td>
                    <td className="num text-right text-fg-muted">
                      {m.cumulative_fans ? formatFans(Number(m.cumulative_fans)) : '–'}
                    </td>
                    <td>
                      {surplus !== null ? (
                        <div className="flex items-center gap-2.5">
                          <span className={`num w-14 font-medium ${surplus >= 0 ? 'text-good' : 'text-warn'}`}>{formatDelta(surplus)}</span>
                          <span
                            className={`hidden h-1.5 rounded-full sm:block ${surplus >= 0 ? 'bg-good/70' : 'bg-warn/70'}`}
                            style={{ width: `${Math.max(4, share * 64)}px` }}
                            aria-hidden
                          />
                        </div>
                      ) : <span className="text-fg-subtle">–</span>}
                    </td>
                    <td className="hidden md:table-cell">
                      {m.days_behind !== null
                        ? <span className={`num ${Number(m.days_behind) > 0 ? 'text-warn' : 'text-fg-subtle'}`}>{Number(m.days_behind) > 0 ? `${m.days_behind}d` : '–'}</span>
                        : <span className="text-fg-subtle">–</span>}
                    </td>
                    <td className="text-right">
                      <MemberToggle memberId={m.member_id} isActive={m.is_active} name={m.trainer_name} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {members.length === 0 && (
          <EmptyState
            icon={UserPlus}
            title={search ? `No members matching "${search}"` : 'No members here yet'}
            body={search ? 'Check the spelling, or clear the search to see everyone.' : 'Members appear after the first daily check, or you can add one by hand.'}
            className="border-t border-line"
          />
        )}
      </div>
    </div>
  )
}
