import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import { Inbox, Info } from 'lucide-react'
import { PageHeader, Chip, Avatar, EmptyState, NoClub } from '@/components/dash/ui'
import LinkTabs from '@/components/dash/LinkTabs'
import { TransferDecision } from './TransferActions'

type TransferRow = {
  request_id: string
  from_club_name: string | null
  discord_user_id: string
  discord_name: string
  trainer_name: string
  trainer_id: string | null
  note: string | null
  status: string
  decided_by_name: string | null
  decided_at: string | null
  decision_note: string | null
  created_at: string
}

function waitingFor(since: string): string {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return '1 day'
  return `${days} days`
}

const statusTone = { approved: 'good', rejected: 'bad', cancelled: 'neutral' } as const
const statusLabel: Record<string, string> = {
  approved: 'Approved', rejected: 'Declined', cancelled: 'Withdrawn',
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'queue' } = await searchParams

  const session = await auth()
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  if (!active) return <NoClub title="Transfers" />

  const queue = await query<TransferRow>(`
    SELECT request_id::text AS request_id, from_club_name,
           discord_user_id::text AS discord_user_id, discord_name,
           trainer_name, trainer_id, note, status,
           decided_by_name, decided_at::text, decision_note, created_at::text
    FROM transfer_requests
    WHERE to_club_id = $1 AND status = 'pending'
    ORDER BY created_at ASC
  `, [active.club_id]).catch(() => [])

  const decided = await query<TransferRow>(`
    SELECT request_id::text AS request_id, from_club_name,
           discord_user_id::text AS discord_user_id, discord_name,
           trainer_name, trainer_id, note, status,
           decided_by_name, decided_at::text, decision_note, created_at::text
    FROM transfer_requests
    WHERE to_club_id = $1 AND status <> 'pending'
    ORDER BY decided_at DESC NULLS LAST, updated_at DESC
    LIMIT 50
  `, [active.club_id]).catch(() => [])

  const isQueue = tab === 'queue'
  const rows = isQueue ? queue : decided

  return (
    <div className="rise space-y-6">
      <PageHeader
        title="Transfers"
        description={<>People asking for a spot in {active.club_name}. Members join the queue with <code className="font-mono text-[13px] text-fg-soft">/transfer_request</code>, which reads their trainer from <code className="font-mono text-[13px] text-fg-soft">/link_trainer</code>.</>}
      />

      {isQueue && queue.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand/20 bg-brand/6 px-5 py-4">
          <Info size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-[13px] leading-relaxed text-fg-muted">
            <span className="font-semibold text-fg">{queue.length} waiting.</span> Position is order of arrival, not a rule, so approve whoever you want in any order. Approving DMs them to check their in-game invites.
          </p>
        </div>
      )}

      <LinkTabs
        id="transfers"
        tabs={[
          { label: 'Queue',   href: '?tab=queue',   count: queue.length,   current: isQueue },
          { label: 'Decided', href: '?tab=decided', count: decided.length, current: !isQueue },
        ]}
      />

      <div className="panel overflow-hidden">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-ui">
              <thead>
                <tr>
                  {isQueue && <th className="w-12">#</th>}
                  <th>Trainer</th>
                  <th className="hidden md:table-cell">Discord</th>
                  <th className="hidden sm:table-cell">Coming from</th>
                  {isQueue ? (
                    <>
                      <th className="hidden sm:table-cell">Waiting</th>
                      <th className="text-right">Decision</th>
                    </>
                  ) : (
                    <>
                      <th>Outcome</th>
                      <th className="hidden md:table-cell">Decided by</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.request_id} className="align-top">
                    {isQueue && <td className="num text-fg-subtle">{i + 1}</td>}
                    <td>
                      <div className="flex items-start gap-3">
                        <Avatar name={r.trainer_name} size={30} />
                        <div className="min-w-0">
                          <p className="font-medium text-fg-soft">{r.trainer_name}</p>
                          {r.trainer_id && <p className="num text-xs text-fg-subtle">{r.trainer_id}</p>}
                          {r.note && <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-fg-muted">&ldquo;{r.note}&rdquo;</p>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <p className="text-fg-muted">{r.discord_name}</p>
                      <p className="num text-xs text-fg-subtle">{r.discord_user_id}</p>
                    </td>
                    <td className="hidden text-fg-muted sm:table-cell">{r.from_club_name ?? '–'}</td>
                    {isQueue ? (
                      <>
                        <td className="hidden text-fg-muted sm:table-cell">{waitingFor(r.created_at)}</td>
                        <td><TransferDecision requestId={r.request_id} trainerName={r.trainer_name} /></td>
                      </>
                    ) : (
                      <>
                        <td>
                          <Chip tone={statusTone[r.status as keyof typeof statusTone] ?? 'neutral'}>
                            {statusLabel[r.status] ?? r.status}
                          </Chip>
                          {r.decision_note && <p className="mt-1.5 max-w-xs text-xs text-fg-muted">{r.decision_note}</p>}
                        </td>
                        <td className="hidden md:table-cell">
                          <p className="text-fg-muted">{r.decided_by_name ?? '–'}</p>
                          {r.decided_at && <p className="num text-xs text-fg-subtle">{new Date(r.decided_at).toLocaleDateString()}</p>}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Inbox}
            title={isQueue ? 'Nobody is waiting to transfer in' : 'No decided requests yet'}
            body={isQueue ? 'New requests show up here and in the sidebar count.' : 'Approved and declined requests are kept here.'}
          />
        )}
      </div>
    </div>
  )
}
