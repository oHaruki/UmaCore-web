import { query } from '@/lib/db'

type Bomb = {
  bomb_id: string
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
  searchParams: Promise<{ tab?: string; club?: string }>
}) {
  const { tab = 'active', club } = await searchParams

  const bombs = await query<Bomb>(`
    SELECT
      b.bomb_id,
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
      ${club ? 'AND b.club_id = $1' : ''}
    ORDER BY b.days_remaining ASC, b.activation_date DESC
  `, club ? [club] : []).catch(() => [])

  const counts = await query<{ is_active: boolean; c: string }>(`
    SELECT is_active, COUNT(*)::text AS c FROM bombs
    ${club ? 'WHERE club_id = $1' : ''}
    GROUP BY is_active
  `, club ? [club] : []).catch(() => [])

  const activeCount   = counts.find(r => r.is_active)?.c  ?? '0'
  const inactiveCount = counts.find(r => !r.is_active)?.c ?? '0'

  const clubs = await query<{ club_id: string; club_name: string }>(
    'SELECT club_id, club_name FROM clubs ORDER BY club_name'
  ).catch(() => [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Bombs</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Members with active bomb countdowns are at risk of removal
          </p>
        </div>

        {/* Club filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">Club</span>
          <div className="flex items-center gap-1 bg-[#0d0d14] border border-white/5 rounded-lg p-1">
            <a href={`?tab=${tab}`}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${!club ? 'bg-white/8 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              All
            </a>
            {clubs.map(c => (
              <a key={c.club_id} href={`?tab=${tab}&club=${c.club_id}`}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${club === c.club_id ? 'bg-white/8 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {c.club_name}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      {tab === 'active' && Number(activeCount) > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-5 py-3 flex items-center gap-3">
          <span className="text-amber-400 text-sm">⚠</span>
          <p className="text-xs text-amber-300">
            <span className="font-medium">{activeCount} active bomb{Number(activeCount) !== 1 ? 's' : ''}</span>
            {' '}— members with 0 days remaining may be removed on the next check.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-white/5">
        {[
          { label: 'Active',   value: 'active',   count: activeCount },
          { label: 'Resolved', value: 'resolved', count: inactiveCount },
        ].map(t => (
          <a key={t.value}
            href={`?tab=${t.value}${club ? `&club=${club}` : ''}`}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t.value ? 'border-violet-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            {t.label} <span className="text-zinc-600">{t.count}</span>
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Trainer</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Club</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Activated</th>
              {tab === 'active' ? (
                <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Days remaining</th>
              ) : (
                <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Resolved</th>
              )}
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Last updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {bombs.map(b => (
              <tr key={b.bomb_id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3">
                  <p className="text-xs font-medium text-white">{b.trainer_name}</p>
                  <p className="text-[10px] text-zinc-600">{b.trainer_id}</p>
                </td>
                <td className="px-5 py-3 text-xs text-zinc-400">{b.club_name}</td>
                <td className="px-5 py-3 text-xs text-zinc-400">
                  {new Date(b.activation_date).toLocaleDateString()}
                </td>
                {tab === 'active' ? (
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded ${
                      b.days_remaining <= 1
                        ? 'bg-red-500/10 text-red-400'
                        : b.days_remaining <= 3
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-zinc-500/10 text-zinc-400'
                    }`}>
                      {b.days_remaining}d left
                    </span>
                  </td>
                ) : (
                  <td className="px-5 py-3 text-xs text-zinc-400">
                    {b.deactivation_date ? new Date(b.deactivation_date).toLocaleDateString() : '—'}
                  </td>
                )}
                <td className="px-5 py-3 text-xs text-zinc-600">
                  {b.last_countdown_update ? new Date(b.last_countdown_update).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {bombs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-xs text-zinc-600 text-center">
                  {tab === 'active' ? 'No active bombs — all members on track.' : 'No resolved bombs yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
