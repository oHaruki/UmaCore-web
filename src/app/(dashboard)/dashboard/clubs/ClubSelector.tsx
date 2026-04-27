'use client'

import { useRouter } from 'next/navigation'

type ClubOption = { club_id: string; club_name: string }

export default function ClubSelector({ clubs, selected }: { clubs: ClubOption[]; selected: string }) {
  const router = useRouter()

  if (clubs.length <= 1) {
    return <span className="text-sm text-zinc-400">{clubs[0]?.club_name}</span>
  }

  return (
    <select
      value={selected}
      onChange={e => router.push(`/dashboard/clubs?clubId=${e.target.value}`)}
      className="bg-[#0d0d14] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-white/20 cursor-pointer"
    >
      {clubs.map(c => (
        <option key={c.club_id} value={c.club_id} className="bg-[#0d0d14]">
          {c.club_name}
        </option>
      ))}
    </select>
  )
}
