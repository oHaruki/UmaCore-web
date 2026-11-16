'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GRADES, LANGUAGES, TAGS } from '@/lib/recruiting-shared'

/** Filter row for the board. Every filter lives in the URL so results can be shared. */
export default function BoardFilters({ tab }: { tab: 'clubs' | 'players' }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const [q, setQ] = useState(params.get('q') ?? '')

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  // search waits for a pause in typing
  useEffect(() => {
    if (q === (params.get('q') ?? '')) return
    const t = setTimeout(() => set('q', q.trim()), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const active = ['q', 'grade', 'lang', 'tag', 'open', 'minavg', 'sort'].some(k => params.get(k))

  const select = (key: string, label: string, options: { value: string; label: string }[]) => (
    <select
      aria-label={label}
      value={params.get(key) ?? ''}
      onChange={e => set(key, e.target.value)}
      className="field pr-8 sm:w-auto"
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )

  return (
    <div className={cn('grid grid-cols-2 gap-2 transition-opacity sm:flex sm:flex-wrap sm:items-center', pending && 'opacity-70')}>
      <label className="relative col-span-2 sm:min-w-[200px] sm:flex-[2_1_220px]">
        <Search size={14} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={tab === 'clubs' ? 'Search clubs' : 'Search trainers'}
          className="field pl-8"
        />
      </label>
      {tab === 'clubs'
        ? select('grade', 'Any grade', GRADES.map(g => ({ value: g, label: `${g} or better` })))
        : select('grade', 'For any club', GRADES.map(g => ({ value: g, label: `Would join a ${g} club` })))}
      {select('lang', 'Any language', LANGUAGES.map(l => ({ value: l, label: l })))}
      {select('tag', 'Any style', TAGS.map(t => ({ value: t.id, label: t.label })))}
      {tab === 'clubs'
        ? select('sort', 'Newest', [{ value: 'rank', label: 'Best rank' }, { value: 'avg', label: 'Highest avg/day' }, { value: 'slots', label: 'Most open slots' }])
        : select('minavg', 'Any pace', [
            { value: '500000', label: '500K+/day' },
            { value: '1000000', label: '1M+/day' },
            { value: '2000000', label: '2M+/day' },
            { value: '3000000', label: '3M+/day' },
          ])}
      {tab === 'clubs' && (
        <label className="flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border border-line-strong bg-surface-2 px-3 text-[13px] text-fg-soft">
          <input
            type="checkbox"
            checked={params.get('open') === '1'}
            onChange={e => set('open', e.target.checked ? '1' : '')}
            className="accent-[var(--uc-brand-solid)]"
          />
          Has open slots
        </label>
      )}
      {active && (
        <button
          onClick={() => { setQ(''); start(() => router.replace(`${pathname}?tab=${tab}`, { scroll: false })) }}
          className="btn btn-ghost btn-sm"
        >
          <X size={14} strokeWidth={1.75} /> Clear
        </button>
      )}
    </div>
  )
}
