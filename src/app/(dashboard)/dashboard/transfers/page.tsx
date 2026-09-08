import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import Link from 'next/link'
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

const statusStyle: Record<string, string> = {
  approved:  'bg-emerald-500/10 text-emerald-400',
  rejected:  'bg-red-500/10 text-red-400',
  cancelled: 'bg-zinc-500/10 text-zinc-400',
}
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

  if (!active) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-white">Transfers</h1>
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-10 text-center text-xs text-zinc-600">
          No club selected. Add a club or pick one from the switcher above.
        </div>
      </div>
    )
  }

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

  const rows = tab === 'queue' ? queue : decided

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Transfers · {active.club_name}</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          People waiting for a spot in this club. Members join the queue with <code className="text-zinc-400">/transfer_request</code>, which reads their trainer details from <code className="text-zinc-400">/link_trainer</code>.
        </p>
      </div>

      {tab === 'queue' && queue.length > 0 && (
        <div className="bg-violet-500/5 border border-violet-500/15 rounded-lg px-5 py-3 flex items-center gap-3">
          <span className="text-violet-400 text-sm">↳</span>
          <p className="text-xs text-violet-200">
            <span className="font-medium">{queue.length} waiting</span>
            {' '}— position is order of arrival, not a rule. Approve whoever you want, in any order.
            Approving DMs them to check their in-game invites.
          </p>
        </div>
      )}

      <div className="flex items-center border-b border-white/5">
        {[
          { label: 'Queue',   value: 'queue',   count: queue.length },
          { label: 'Decided', value: 'decided', count: decided.length },
        ].map(t => (
          <Link key={t.value}
            href={`?tab=${t.value}`}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t.value ? 'border-violet-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            {t.label} <span className="text-zinc-600">{t.count}</span>
          </Link>
        ))}
      </div>

      <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {tab === 'queue' && (
                <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal w-12">#</th>
              )}
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Trainer</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Discord</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Coming from</th>
              {tab === 'queue' ? (
                <>
                  <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Waiting</th>
                  <th className="px-5 py-3 text-right text-xs text-zinc-500 font-normal">Decision</th>
                </>
              ) : (
                <>
                  <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Outcome</th>
                  <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Decided by</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r, i) => (
              <tr key={r.request_id} className="hover:bg-white/[0.02] transition-colors align-top">
                {tab === 'queue' && (
                  <td className="px-5 py-3 text-xs text-zinc-600">{i + 1}</td>
                )}
                <td className="px-5 py-3">
                  <p className="text-xs font-medium text-white">{r.trainer_name}</p>
                  {r.trainer_id && <p className="text-[10px] text-zinc-600">{r.trainer_id}</p>}
                  {r.note && <p className="text-[10px] text-zinc-500 mt-1 max-w-xs">{r.note}</p>}
                </td>
                <td className="px-5 py-3">
                  <p className="text-xs text-zinc-400">{r.discord_name}</p>
                  <p className="text-[10px] text-zinc-600">{r.discord_user_id}</p>
                </td>
                <td className="px-5 py-3 text-xs text-zinc-400">{r.from_club_name ?? '—'}</td>
                {tab === 'queue' ? (
                  <>
                    <td className="px-5 py-3 text-xs text-zinc-500">{waitingFor(r.created_at)}</td>
                    <td className="px-5 py-3">
                      <TransferDecision requestId={r.request_id} trainerName={r.trainer_name} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded ${statusStyle[r.status] ?? 'bg-zinc-500/10 text-zinc-400'}`}>
                        {statusLabel[r.status] ?? r.status}
                      </span>
                      {r.decision_note && (
                        <p className="text-[10px] text-zinc-500 mt-1 max-w-xs">{r.decision_note}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500">
                      {r.decided_by_name ?? '—'}
                      {r.decided_at && (
                        <p className="text-[10px] text-zinc-600">
                          {new Date(r.decided_at).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-xs text-zinc-600 text-center">
                  {tab === 'queue'
                    ? 'Nobody is waiting to transfer in.'
                    : 'No decided requests yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
