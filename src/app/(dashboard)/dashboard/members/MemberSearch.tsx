'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition, useState } from 'react'
import { Search } from 'lucide-react'

export default function MemberSearch() {
  const router      = useRouter()
  const pathname    = usePathname()
  const sp          = useSearchParams()
  const [, startT]  = useTransition()
  const [value, setValue] = useState(sp.get('search') ?? '')

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setValue(v)
    const params = new URLSearchParams(sp.toString())
    if (v) params.set('search', v)
    else params.delete('search')
    startT(() => router.replace(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="relative">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
      <input
        value={value}
        onChange={onChange}
        placeholder="Search trainer…"
        className="pl-8 pr-3 py-1.5 text-xs bg-[#0d0d14] border border-white/5 rounded-lg text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-white/15 transition-colors w-48"
      />
    </div>
  )
}
