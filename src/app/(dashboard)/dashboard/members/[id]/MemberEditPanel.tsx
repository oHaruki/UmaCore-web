'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function MemberEditPanel({
  memberId,
  initialJoinDate,
  initialTrainerName,
  lastSeen,
  manuallyDeactivated,
}: {
  memberId: string
  initialJoinDate: string
  initialTrainerName: string
  lastSeen: string | null
  manuallyDeactivated: boolean
}) {
  const router = useRouter()
  const [joinDate, setJoinDate]         = useState(initialJoinDate.slice(0, 10))
  const [trainerName, setTrainerName]   = useState(initialTrainerName)
  const [joinStatus, setJoinStatus]     = useState<SaveStatus>('idle')
  const [nameStatus, setNameStatus]     = useState<SaveStatus>('idle')

  async function save(fields: Record<string, unknown>, setStatus: (s: SaveStatus) => void) {
    setStatus('saving')
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error()
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
      router.refresh()
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5">
        <p className="text-xs font-medium text-zinc-400">Member details</p>
      </div>
      <div className="px-5 py-4 grid grid-cols-2 gap-4">

        {/* Trainer name */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-zinc-500">Trainer name</label>
            <StatusDot status={nameStatus} />
          </div>
          <input
            value={trainerName}
            onChange={e => setTrainerName(e.target.value)}
            onBlur={() => {
              if (trainerName !== initialTrainerName) save({ trainer_name: trainerName }, setNameStatus)
            }}
            className="w-full bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Join date */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-zinc-500">
              Join date
              {joinStatus === 'saving' && <span className="ml-2 text-zinc-600">recalculating…</span>}
            </label>
            <StatusDot status={joinStatus} />
          </div>
          <input
            type="date"
            value={joinDate}
            onChange={e => setJoinDate(e.target.value)}
            onBlur={() => {
              if (joinDate !== initialJoinDate.slice(0, 10)) save({ join_date: joinDate }, setJoinStatus)
            }}
            className="w-full bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors [color-scheme:dark]"
          />
          <p className="text-[10px] text-zinc-700 mt-1">Changing this recalculates quota history</p>
        </div>

        {/* Read-only meta */}
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">Last seen</p>
          <p className="text-sm text-zinc-400">
            {lastSeen ? new Date(lastSeen).toLocaleDateString() : '—'}
          </p>
        </div>

        <div>
          <p className="text-xs text-zinc-500 mb-1.5">Deactivation</p>
          <p className={`text-sm ${manuallyDeactivated ? 'text-amber-400' : 'text-zinc-600'}`}>
            {manuallyDeactivated ? 'Manually deactivated' : '—'}
          </p>
        </div>

      </div>
    </div>
  )
}

function StatusDot({ status }: { status: SaveStatus }) {
  if (status === 'idle')   return null
  if (status === 'saving') return <span className="text-[10px] text-zinc-600">saving…</span>
  if (status === 'saved')  return <span className="text-[10px] text-emerald-500">saved</span>
  return <span className="text-[10px] text-red-400">error</span>
}
