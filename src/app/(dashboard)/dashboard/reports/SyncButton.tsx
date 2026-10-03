'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Check, AlertTriangle } from 'lucide-react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function SyncButton({ clubId, hasCircleId }: { clubId: string; hasCircleId: boolean }) {
  const [status, setStatus] = useState<Status>('idle')
  const [detail, setDetail] = useState('')
  const router = useRouter()

  if (!hasCircleId) {
    return (
      <span className="text-xs text-fg-subtle" title="Add a circle ID in Settings to sync from uma.moe">
        No circle ID
      </span>
    )
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
        setDetail('Large backfill, refreshing')
        // Bot finished writing but connection dropped; give it a moment before refreshing
        setTimeout(() => { router.refresh(); setTimeout(() => setStatus('idle'), 3000) }, 3000)
      } else {
        const parts = [`${json.updated_members} members`]
        if (json.backfilled) parts.push(`${json.backfilled} days backfilled`)
        setDetail(parts.join(', '))
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
    <div className="flex items-center gap-2.5" aria-live="polite">
      {status === 'success' && (
        <span className="inline-flex items-center gap-1 text-xs text-good">
          <Check size={13} strokeWidth={2} /> {detail} synced
        </span>
      )}
      {status === 'error' && (
        <span className="inline-flex max-w-[16rem] items-center gap-1 truncate text-xs text-bad" title={detail}>
          <AlertTriangle size={13} strokeWidth={2} /> {detail || 'Sync failed'}
        </span>
      )}
      <button onClick={handleSync} disabled={status === 'loading'} className="btn btn-secondary">
        <RefreshCw size={14} strokeWidth={1.75} className={status === 'loading' ? 'animate-spin' : ''} />
        {status === 'loading' ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  )
}
