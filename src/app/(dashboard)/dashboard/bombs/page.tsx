import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import Link from 'next/link'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { PageHeader, Chip, Avatar, EmptyState, NoClub } from '@/components/dash/ui'
import LinkTabs from '@/components/dash/LinkTabs'

type Bomb = {
  bomb_id: string
  member_id: string
  trainer_name: string
  trainer_id: string
  club_name: string
  activation_date: string
  days_remaining: number
  is_active: boolean
  deactivation_date: string | null
  last_countdown_update: string | null
}

export default async function BombsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'active' } = await searchParams

  const session = await auth()
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  if (!active) return <NoClub title="Bombs" />

  const bombs = await query<Bomb>(`
    SELECT
      b.bomb_id,
      b.member_id::text,
      m.trainer_name,
      m.trainer_id,
      c.club_name,
      b.activation_date::text,
      b.days_remaining,
      b.is_active,
      b.deactivation_date::text,
      b.last_countdown_update::text
    FROM bombs b
    JOIN members m ON m.member_id = b.member_id
    JOIN clubs   c ON c.club_id   = b.club_id
    WHERE b.is_active = ${tab === 'active' ? 'true' : 'false'}
      AND b.club_id = $1
    ORDER BY b.days_remaining ASC, b.activation_date DESC
  `, [active.club_id]).catch(() => [])

  const counts = await query<{ is_active: boolean; c: string }>(`
    SELECT b.is_active, COUNT(*)::text AS c
    FROM bombs b
    WHERE b.club_id = $1
    GROUP BY b.is_active
  `, [active.club_id]).catch(() => [])

  const activeCount   = counts.find(r => r.is_active)?.c  ?? '0'
  const inactiveCount = counts.find(r => !r.is_active)?.c ?? '0'
  const critical = bombs.filter(b => b.is_active && b.days_remaining <= 1).length

  return (
    <div className="rise space-y-6">
      <PageHeader
        title="Bombs"
        description="A bomb starts when a member stays behind too long. If the countdown runs out before they catch up, they can be removed."
      />

      {tab === 'active' && Number(activeCount) > 0 && (
        <div className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${critical ? 'border-bad/30 bg-bad/8' : 'border-warn/20 bg-warn/6'}`}>
          <AlertTriangle size={18} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${critical ? 'text-bad' : 'text-warn'}`} />
          <p className="text-[13px] leading-relaxed text-fg-muted">
            <span className="font-semibold text-fg">{activeCount} active bomb{Number(activeCount) !== 1 ? 's' : ''}.</span>{' '}
            {critical
              ? <>{critical} {critical === 1 ? 'member has' : 'members have'} a day or less left and may be removed at the next check.</>
              : <>Members defuse a bomb by getting back on track at any daily check.</>}
          </p>
        </div>
      )}

      <LinkTabs
        id="bombs"
        tabs={[
          { label: 'Active',   href: '?tab=active',   count: Number(activeCount),   current: tab === 'active' },
          { label: 'Resolved', href: '?tab=resolved', count: Number(inactiveCount), current: tab !== 'active' },
        ]}
      />

      <div className="panel overflow-hidden">
        {bombs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-ui">
              <thead>
                <tr>
                  <th>Trainer</th>
                  <th>Started</th>
                  <th>{tab === 'active' ? 'Countdown' : 'Resolved'}</th>
                  <th className="hidden md:table-cell">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {bombs.map(b => (
                  <tr key={b.bomb_id}>
                    <td>
                      <Link href={`/dashboard/members/${b.member_id}`} className="group flex items-center gap-3">
                        <Avatar name={b.trainer_name} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg-soft group-hover:text-fg">{b.trainer_name}</span>
                          <span className="num block text-xs text-fg-subtle">{b.trainer_id}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="num text-fg-muted">{new Date(b.activation_date).toLocaleDateString()}</td>
                    {tab === 'active' ? (
                      <td>
                        <div className="flex items-center gap-3">
                          <Chip tone={b.days_remaining <= 1 ? 'bad' : b.days_remaining <= 3 ? 'warn' : 'neutral'} className="num">
                            {b.days_remaining} day{b.days_remaining === 1 ? '' : 's'} left
                          </Chip>
                          <Fuse days={b.days_remaining} />
                        </div>
                      </td>
                    ) : (
                      <td className="num text-fg-muted">
                        {b.deactivation_date ? new Date(b.deactivation_date).toLocaleDateString() : '–'}
                      </td>
                    )}
                    <td className="num hidden text-fg-subtle md:table-cell">
                      {b.last_countdown_update ? new Date(b.last_countdown_update).toLocaleDateString() : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title={tab === 'active' ? 'No active bombs' : 'No resolved bombs yet'}
            body={tab === 'active' ? 'Nobody has been behind long enough to start one.' : 'Bombs show up here once they are defused or run out.'}
          />
        )}
      </div>
    </div>
  )
}

/** Remaining days as burning segments, capped at 7 so long countdowns stay compact. */
function Fuse({ days }: { days: number }) {
  const shown = Math.min(7, Math.max(0, days))
  const color = days <= 1 ? 'bg-bad' : days <= 3 ? 'bg-warn' : 'bg-fg-subtle'
  return (
    <span className="hidden items-center gap-0.5 sm:flex" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className={`h-2.5 w-1.5 rounded-sm ${i < shown ? color : 'bg-surface-3'}`} />
      ))}
    </span>
  )
}
