'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { formatDelta, formatFans } from '@/lib/format'
import { Avatar, Chip, DeltaBar } from '@/components/dash/ui'
import { cn } from '@/lib/utils'

export type StandingRow = {
  member_id: string
  trainer_name: string
  surplus: number
  fans: number
  days_behind: number
  bomb_days: number | null
}

type SortKey = 'surplus' | 'fans' | 'trainer_name' | 'days_behind'

export default function StandingsTable({ rows }: { rows: StandingRow[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'surplus', desc: true })

  const maxAbs = useMemo(() => Math.max(1, ...rows.map(r => Math.abs(r.surplus))), [rows])
  // Place by surplus, independent of how the table is sorted.
  const place = useMemo(() => {
    const m = new Map<string, number>()
    ;[...rows].sort((a, b) => b.surplus - a.surplus).forEach((r, i) => m.set(r.member_id, i + 1))
    return m
  }, [rows])

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = q ? rows.filter(r => r.trainer_name.toLowerCase().includes(q)) : [...rows]
    list.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key]
      const c = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sort.desc ? -c : c
    })
    return list
  }, [rows, filter, sort])

  function toggle(key: SortKey) {
    setSort(s => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'trainer_name' }))
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-5 pb-3">
        <div className="relative w-full max-w-xs">
          <Search size={14} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter trainers"
            aria-label="Filter trainers"
            className="field h-8 pl-8 text-[13px]"
          />
        </div>
        <span className="num ml-auto whitespace-nowrap text-xs text-fg-subtle">
          {shown.length === rows.length ? `${rows.length} members` : `${shown.length} of ${rows.length}`}
        </span>
      </div>
      <div className="max-h-[560px] overflow-auto border-t border-line">
        <table className="table-ui">
          <thead className="sticky top-0 z-[1]">
            <tr>
              <th className="w-12">#</th>
              <Th k="trainer_name" sort={sort} onSort={toggle}>Trainer</Th>
              <Th k="surplus" sort={sort} onSort={toggle}>Surplus</Th>
              <Th k="fans" sort={sort} onSort={toggle} className="hidden sm:table-cell">Fans this month</Th>
              <Th k="days_behind" sort={sort} onSort={toggle} className="hidden md:table-cell">Days behind</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map(m => (
              <tr
                key={m.member_id}
                onClick={() => router.push(`/dashboard/members/${m.member_id}`)}
                className="cursor-pointer"
              >
                <td className="num text-fg-subtle">{place.get(m.member_id)}</td>
                <td>
                  <a
                    href={`/dashboard/members/${m.member_id}`}
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-2.5 font-medium text-fg-soft hover:text-fg"
                  >
                    <Avatar name={m.trainer_name} size={26} />
                    <span className="truncate">{m.trainer_name}</span>
                    {m.bomb_days !== null && (
                      <Chip tone={m.bomb_days <= 1 ? 'bad' : 'warn'} title="Active bomb">💣 {m.bomb_days}d</Chip>
                    )}
                  </a>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <span className={cn('num w-14 font-medium', m.surplus >= 0 ? 'text-good' : 'text-warn')}>
                      {formatDelta(m.surplus)}
                    </span>
                    <span className="hidden sm:block"><DeltaBar value={m.surplus} max={maxAbs} /></span>
                  </div>
                </td>
                <td className="num hidden text-fg-muted sm:table-cell">{formatFans(m.fans)}</td>
                <td className="hidden md:table-cell">
                  {m.days_behind > 0
                    ? <span className="num text-warn">{m.days_behind}d</span>
                    : <span className="text-fg-subtle">–</span>}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-fg-subtle">
                  {rows.length ? `No trainer matches "${filter}".` : 'No active members with quota data yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({
  k,
  sort,
  onSort,
  children,
  className,
}: {
  k: SortKey
  sort: { key: SortKey; desc: boolean }
  onSort: (k: SortKey) => void
  children: React.ReactNode
  className?: string
}) {
  const current = sort.key === k
  return (
    <th className={className} aria-sort={current ? (sort.desc ? 'descending' : 'ascending') : undefined}>
      <button
        onClick={() => onSort(k)}
        className={cn('inline-flex items-center gap-1 transition-colors hover:text-fg', current && 'text-fg-soft')}
      >
        {children}
        {current && (sort.desc ? <ArrowDown size={12} strokeWidth={2} /> : <ArrowUp size={12} strokeWidth={2} />)}
      </button>
    </th>
  )
}
