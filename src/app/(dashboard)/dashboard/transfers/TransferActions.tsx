'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function TransferDecision({
  requestId,
  trainerName,
}: {
  requestId: string
  trainerName: string
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function decide(action: 'approve' | 'reject') {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/transfers/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setDeclining(false)
      setReason('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => decide('approve')}
          disabled={busy !== null}
          className="text-xs text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-3 py-1.5 rounded transition-colors"
        >
          {busy === 'approve' ? '…' : 'Approve'}
        </button>
        <button
          onClick={() => setDeclining(true)}
          disabled={busy !== null}
          className="text-xs text-zinc-400 hover:text-red-300 disabled:opacity-40 px-2 py-1.5 rounded hover:bg-red-500/10 transition-colors"
        >
          Decline
        </button>
      </div>

      {error && <p className="text-[10px] text-red-400 max-w-[14rem] text-right">{error}</p>}

      {declining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0d0d14] border border-white/8 rounded-lg w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <p className="text-sm font-medium text-white">Decline {trainerName}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                They&apos;ll be DMed. A reason is optional but is shown to them.
              </p>
            </div>
            <div className="px-5 py-5 space-y-4">
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="e.g. no free spots this month — try again after reset"
                className="w-full bg-[#111118] border border-white/8 rounded px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 transition-colors placeholder:text-zinc-700 resize-none"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => { setDeclining(false); setReason(''); setError(null) }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => decide('reject')}
                  disabled={busy !== null}
                  className="text-xs text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 rounded transition-colors"
                >
                  {busy === 'reject' ? 'Declining…' : 'Decline request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
