'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

type ClubOption = { club_id: string; club_name: string; is_active: boolean }

export default function ClubSwitcher({
  clubs,
  activeId,
}: {
  clubs: ClubOption[]
  activeId: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (clubs.length === 0) return null

  const change = (id: string) => {
    if (id === activeId) return
    startTransition(async () => {
      await fetch('/api/active-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: id }),
      })
      router.refresh()
    })
  }

  // A single club needs no switcher — just show its name.
  if (clubs.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-zinc-600">Club</span>
        <span className="text-sm text-zinc-300">{clubs[0].club_name}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-zinc-600">Club</span>
      <select
        value={activeId ?? ''}
        onChange={e => change(e.target.value)}
        disabled={pending}
        className="bg-[#0d0d14] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-white/20 cursor-pointer disabled:opacity-60"
      >
        {clubs.map(c => (
          <option key={c.club_id} value={c.club_id} className="bg-[#0d0d14]">
            {c.club_name}
            {!c.is_active ? ' (inactive)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
