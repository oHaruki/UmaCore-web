'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import Modal, { Field } from '@/components/dash/Modal'

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
      <div className="flex items-center justify-end gap-1.5">
        <button onClick={() => setDeclining(true)} disabled={busy !== null} className="btn btn-sm btn-danger-ghost">
          Decline
        </button>
        <button onClick={() => decide('approve')} disabled={busy !== null} className="btn btn-sm btn-good">
          <Check size={14} strokeWidth={2.25} />
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
      </div>

      {error && !declining && <p className="max-w-[14rem] text-right text-xs text-bad" role="alert">{error}</p>}

      <Modal
        open={declining}
        onClose={() => { setDeclining(false); setReason(''); setError(null) }}
        title={`Decline ${trainerName}`}
        description="They'll get a DM. The reason is optional, but they will see it."
        footer={
          <>
            <button onClick={() => { setDeclining(false); setReason(''); setError(null) }} className="btn btn-ghost">Cancel</button>
            <button onClick={() => decide('reject')} disabled={busy !== null} className="btn btn-danger">
              {busy === 'reject' ? 'Declining…' : 'Decline request'}
            </button>
          </>
        }
      >
        <Field label="Reason" htmlFor={`decline-${requestId}`} error={error}>
          <textarea
            id={`decline-${requestId}`}
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder="e.g. No free spots this month, try again after the reset"
            className="field resize-none"
          />
        </Field>
      </Modal>
    </div>
  )
}
