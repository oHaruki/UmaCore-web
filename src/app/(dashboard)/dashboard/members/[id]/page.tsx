import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { ownsClub } from '@/lib/guild-check'
import { notFound, forbidden } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import MemberEditPanel from './MemberEditPanel'

type Member = {
  member_id: string
  trainer_name: string
  trainer_id: string
  club_name: string
  club_id: string
  is_active: boolean
  manually_deactivated: boolean
  join_date: string | null
  last_seen: string | null
  daily_quota: string
  quota_period: string
}

type UserLink = {
  discord_user_id: string
  notify_on_bombs: boolean
  notify_on_deficit: boolean
}

type HistoryEntry = {
  date: string
  cumulative_fans: string
  expected_fans: string
  deficit_surplus: string
  days_behind: string
}

type Bomb = {
  bomb_id: string
  days_remaining: number
  activation_date: string
  is_active: boolean
  deactivation_date: string | null
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()

  const [member] = await query<Member>(`
    SELECT m.member_id, m.trainer_name, m.trainer_id, m.is_active, m.manually_deactivated,
           m.join_date::text, m.last_seen::text, c.club_name, c.club_id,
           c.daily_quota::text, c.quota_period
    FROM members m JOIN clubs c ON c.club_id = m.club_id
    WHERE m.member_id = $1
  `, [id]).catch(() => [])

  if (!member) notFound()
  if (!(await ownsClub(session!, member.club_id))) forbidden()

  const [userLink] = await query<UserLink>(`
    SELECT discord_user_id::text, notify_on_bombs, notify_on_deficit
    FROM user_links WHERE member_id = $1
  `, [id]).catch(() => [])

  const history = await query<HistoryEntry>(`
    SELECT date::text, cumulative_fans::text, expected_fans::text,
           deficit_surplus::text, days_behind::text
    FROM quota_history
    WHERE member_id = $1
    ORDER BY date ASC
  `, [id]).catch(() => [])

  const bombs = await query<Bomb>(`
    SELECT bomb_id, days_remaining, activation_date::text, is_active, deactivation_date::text
    FROM bombs WHERE member_id = $1
    ORDER BY is_active DESC, activation_date DESC
  `, [id]).catch(() => [])

  const activeBomb = bombs.find(b => b.is_active)

  // Summary stats
  const total      = history.length
  const onTrack    = history.filter(h => Number(h.deficit_surplus) >= 0).length
  const behind     = total - onTrack
  const latest     = history[history.length - 1]
  const avgSurplus = total > 0
    ? Math.round(history.reduce((s, h) => s + Number(h.deficit_surplus), 0) / total)
    : 0

  // Catch-up calculation: how much per day to recover deficit by end of month
  const periodDays  = { daily: 1, weekly: 7, 'bi-weekly': 14 }[member.quota_period] ?? 1
  const perDayQuota = Number(member.daily_quota) / periodDays
  const currentDeficit = latest ? Math.max(0, -Number(latest.deficit_surplus)) : 0
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysRemaining = Math.max(1, daysInMonth - today.getDate())
  const catchUpPerDay = currentDeficit > 0
    ? Math.ceil(perDayQuota + currentDeficit / daysRemaining)
    : null

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div>
        <Link href="/dashboard/members" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
          <ArrowLeft size={12} />
          Back to members
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-white">{member.trainer_name}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-medium ${
              member.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-zinc-500'
            }`}>
              <span className={`w-1 h-1 rounded-full ${member.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              {member.is_active ? 'Active' : 'Inactive'}
            </span>
            {activeBomb && (
              <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-medium ${
                activeBomb.days_remaining <= 1 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
              }`}>
                💣 {activeBomb.days_remaining}d left
              </span>
            )}
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs text-zinc-500">Trainer ID: {member.trainer_id}</p>
            <p className="text-xs text-zinc-600">{member.club_name}</p>
            {userLink ? (
              <p className="text-xs text-violet-400">
                Discord linked
                {userLink.notify_on_bombs || userLink.notify_on_deficit
                  ? ` · notified on ${[userLink.notify_on_bombs && 'bombs', userLink.notify_on_deficit && 'deficit'].filter(Boolean).join(' & ')}`
                  : ''}
              </p>
            ) : (
              <p className="text-xs text-zinc-700">No Discord link</p>
            )}
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Days tracked',  value: String(total) },
          { label: 'Days on track', value: String(onTrack), color: 'text-emerald-400' },
          { label: 'Days behind',   value: String(behind),  color: behind > 0 ? 'text-amber-400' : undefined },
          { label: 'Avg surplus',   value: (avgSurplus >= 0 ? '+' : '') + formatFans(avgSurplus), color: avgSurplus >= 0 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Latest fans',   value: latest ? formatFans(Number(latest.cumulative_fans)) : '—' },
          {
            label: catchUpPerDay ? 'Need / day to recover' : 'Daily target',
            value: catchUpPerDay ? formatFans(catchUpPerDay) : formatFans(Math.ceil(perDayQuota)),
            color: catchUpPerDay ? 'text-amber-400' : 'text-zinc-400',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0d0d14] border border-white/5 rounded-lg p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`mt-1.5 text-xl font-semibold ${color ?? 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {history.length >= 2 && (
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-white">Fan progression</p>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-emerald-500 inline-block" />Actual fans</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-zinc-600 inline-block border-dashed border-t border-zinc-600" />Expected</span>
            </div>
          </div>
          <QuotaChart data={history.map(h => ({
            date: h.date,
            cumulative: Number(h.cumulative_fans),
            expected: Number(h.expected_fans),
          }))} />
        </div>
      )}

      {/* Bombs */}
      {bombs.length > 0 && (
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5">
            <p className="text-sm font-medium text-white">Bomb history</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Activated</th>
                <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Status</th>
                <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Days remaining</th>
                <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bombs.map(b => (
                <tr key={b.bomb_id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-xs text-zinc-300">{new Date(b.activation_date).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${b.is_active ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-zinc-500'}`}>
                      {b.is_active ? 'Active' : 'Resolved'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-400">{b.days_remaining}d</td>
                  <td className="px-5 py-3 text-xs text-zinc-600">
                    {b.deactivation_date ? new Date(b.deactivation_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Full quota history */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Quota history</p>
          <span className="text-xs text-zinc-600">{history.length} entries</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Date</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Cumulative fans</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Expected</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Surplus / Deficit</th>
              <th className="px-5 py-3 text-left text-xs text-zinc-500 font-normal">Days behind</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[...history].reverse().map((h, i) => {
              const val = Number(h.deficit_surplus)
              return (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-xs text-zinc-400">{new Date(h.date).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-xs text-zinc-300">{formatFans(Number(h.cumulative_fans))}</td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{formatFans(Number(h.expected_fans))}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${val >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {val >= 0 ? '+' : ''}{formatFans(val)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs ${Number(h.days_behind) > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                      {h.days_behind}d
                    </span>
                  </td>
                </tr>
              )
            })}
            {history.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-xs text-zinc-600 text-center">No history yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Editable fields */}
      <MemberEditPanel
        memberId={member.member_id}
        initialJoinDate={member.join_date ?? ''}
        initialTrainerName={member.trainer_name}
        lastSeen={member.last_seen}
        manuallyDeactivated={member.manually_deactivated}
      />
    </div>
  )
}

function QuotaChart({ data }: { data: { date: string; cumulative: number; expected: number }[] }) {
  const W = 800, H = 160
  const pad = { top: 8, right: 8, bottom: 24, left: 56 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  const maxY = Math.max(...data.map(d => Math.max(d.cumulative, d.expected)), 1)
  const xOf = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * plotW
  const yOf = (v: number) => pad.top + plotH - (v / maxY) * plotH

  const actual   = data.map((d, i) => `${xOf(i)},${yOf(d.cumulative)}`).join(' ')
  const expected = data.map((d, i) => `${xOf(i)},${yOf(d.expected)}`).join(' ')

  // Y axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: pad.top + plotH - t * plotH,
    label: formatFans(Math.round(maxY * t)),
  }))

  // X axis: show up to 6 dates
  const xStep = Math.max(1, Math.floor(data.length / 6))
  const xLabels = data
    .map((d, i) => ({ i, date: d.date }))
    .filter((_, i) => i % xStep === 0 || i === data.length - 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {/* Grid lines */}
      {yLabels.map(({ y, label }) => (
        <g key={label}>
          <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#ffffff08" strokeWidth="1" />
          <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#52525b">{label}</text>
        </g>
      ))}

      {/* Expected line (dashed) */}
      <polyline points={expected} fill="none" stroke="#3f3f46" strokeWidth="1.5" strokeDasharray="4 3" />

      {/* Actual line */}
      <polyline points={actual} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />

      {/* Latest dot */}
      {data.length > 0 && (
        <circle
          cx={xOf(data.length - 1)}
          cy={yOf(data[data.length - 1].cumulative)}
          r="3" fill="#10b981"
        />
      )}

      {/* X labels */}
      {xLabels.map(({ i, date }) => (
        <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#52525b">
          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}
    </svg>
  )
}

function formatFans(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`
  return String(n)
}
