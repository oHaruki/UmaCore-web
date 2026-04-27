'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function SyncButton({ clubId, hasCircleId }: { clubId: string; hasCircleId: boolean }) {
  const [status, setStatus] = useState<Status>('idle')
  const [detail, setDetail] = useState('')
  const router = useRouter()

  if (!hasCircleId) {
    return <span className="text-[10px] text-zinc-700">No circle ID</span>
  }

  async function handleSync() {
    setStatus('loading')
    setDetail('')
    try {
      const res = await fetch(`/api/sync/${clubId}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      setStatus('success')
      if (json.note === 'response incomplete') {
        setDetail('synced (large backfill — refreshing…)')
        // Bot finished writing but connection dropped; give it a moment before refreshing
        setTimeout(() => { router.refresh(); setTimeout(() => setStatus('idle'), 3000) }, 3000)
      } else {
        const parts = [`${json.updated_members} members`]
        if (json.backfilled) parts.push(`${json.backfilled} days backfilled`)
        setDetail(parts.join(' · '))
        router.refresh()
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch (err) {
      setStatus('error')
      setDetail(err instanceof Error ? err.message : String(err))
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'success' && (
        <span className="text-[10px] text-emerald-500">{detail} synced</span>
      )}
      {status === 'error' && (
        <span className="text-[10px] text-red-400" title={detail}>Error</span>
      )}
      <button
        onClick={handleSync}
        disabled={status === 'loading'}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={11} className={status === 'loading' ? 'animate-spin' : ''} />
        {status === 'loading' ? 'Syncing…' : 'Sync'}
      </button>
    </div>
  )
}
