'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, AlertTriangle } from 'lucide-react'

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
    <section className="panel overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold text-fg">Member details</h2>
        <p className="mt-0.5 text-[13px] text-fg-subtle">Saves when you leave a field.</p>
      </div>
      <div className="space-y-4 px-5 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="me-name" className="text-[13px] font-medium text-fg-soft">Trainer name</label>
            <SaveState status={nameStatus} />
          </div>
          <input
            id="me-name"
            value={trainerName}
            onChange={e => setTrainerName(e.target.value)}
            onBlur={() => {
              if (trainerName !== initialTrainerName) save({ trainer_name: trainerName }, setNameStatus)
            }}
            className="field"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="me-join" className="text-[13px] font-medium text-fg-soft">Join date</label>
            <SaveState status={joinStatus} savingLabel="Recalculating" />
          </div>
          <input
            id="me-join"
            type="date"
            value={joinDate}
            onChange={e => setJoinDate(e.target.value)}
            onBlur={() => {
              if (joinDate !== initialJoinDate.slice(0, 10)) save({ join_date: joinDate }, setJoinStatus)
            }}
            className="field num"
          />
          <p className="text-xs text-fg-subtle">Changing this recalculates quota history.</p>
        </div>

        <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4">
          <div>
            <dt className="text-xs text-fg-subtle">Last seen</dt>
            <dd className="num mt-0.5 text-[13px] text-fg-soft">
              {lastSeen ? new Date(lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '–'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Deactivation</dt>
            <dd className={`mt-0.5 text-[13px] ${manuallyDeactivated ? 'text-warn' : 'text-fg-soft'}`}>
              {manuallyDeactivated ? 'Manually deactivated' : '–'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

function SaveState({ status, savingLabel = 'Saving' }: { status: SaveStatus; savingLabel?: string }) {
  if (status === 'idle') return null
  if (status === 'saving') {
    return <span className="inline-flex items-center gap-1 text-xs text-fg-subtle"><Loader2 size={12} className="animate-spin" />{savingLabel}</span>
  }
  if (status === 'saved') {
    return <span className="inline-flex items-center gap-1 text-xs text-good"><Check size={12} strokeWidth={2.25} />Saved</span>
  }
  return <span className="inline-flex items-center gap-1 text-xs text-bad"><AlertTriangle size={12} strokeWidth={2} />Not saved</span>
}
