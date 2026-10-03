'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition, useState } from 'react'
import { Search, X } from 'lucide-react'

export default function MemberSearch() {
  const router      = useRouter()
  const pathname    = usePathname()
  const sp          = useSearchParams()
  const [pending, startT] = useTransition()
  const [value, setValue] = useState(sp.get('search') ?? '')

  function update(v: string) {
    setValue(v)
    const params = new URLSearchParams(sp.toString())
    if (v) params.set('search', v)
    else params.delete('search')
    startT(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  return (
    <div className="relative w-full sm:w-64">
      <Search
        size={14}
        strokeWidth={1.75}
        className={`pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 ${pending ? 'animate-pulse text-brand' : 'text-fg-subtle'}`}
      />
      <input
        value={value}
        onChange={e => update(e.target.value)}
        placeholder="Search trainers"
        aria-label="Search trainers"
        className="field pr-8 pl-8"
      />
      {value && (
        <button
          onClick={() => update('')}
          className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded text-fg-subtle hover:text-fg"
          aria-label="Clear search"
        >
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
