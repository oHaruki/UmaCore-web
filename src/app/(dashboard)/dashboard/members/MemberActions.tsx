'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import Modal, { Field } from '@/components/dash/Modal'

export function MemberToggle({
  memberId,
  isActive,
  name,
}: {
  memberId: string
  isActive: boolean
  name?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive, manually_deactivated: isActive }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={`${isActive ? 'Deactivate' : 'Activate'}${name ? ` ${name}` : ''}`}
      title={error ? 'Could not save. Try again.' : undefined}
      className={`btn btn-xs ${error ? 'text-bad' : isActive ? 'btn-danger-ghost' : 'btn-ghost text-good'}`}
    >
      {loading ? 'Saving…' : error ? 'Retry' : isActive ? 'Deactivate' : 'Activate'}
    </button>
  )
}

export function AddMemberButton({ clubs }: { clubs: { club_id: string; club_name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    trainer_name: '',
    trainer_id: '',
    club_id: clubs[0]?.club_id ?? '',
    join_date: new Date().toISOString().split('T')[0],
  })
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setOpen(false)
      setForm({ trainer_name: '', trainer_id: '', club_id: clubs[0]?.club_id ?? '', join_date: new Date().toISOString().split('T')[0] })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <UserPlus size={16} strokeWidth={1.75} />
        Add member
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add member"
        description="For trainers the daily check hasn't picked up yet."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
            <button type="submit" form="add-member-form" disabled={saving} className="btn btn-primary">
              {saving ? 'Adding…' : 'Add member'}
            </button>
          </>
        }
      >
        <form id="add-member-form" onSubmit={submit} className="space-y-4">
          <Field label="Trainer name" htmlFor="am-name">
            <input
              id="am-name"
              required
              value={form.trainer_name}
              onChange={e => setForm(f => ({ ...f, trainer_name: e.target.value }))}
              placeholder="e.g. Gwiyomi"
              className="field"
            />
          </Field>
          <Field label="Trainer ID" htmlFor="am-id" hint="The ID shown on the trainer's in-game profile.">
            <input
              id="am-id"
              required
              value={form.trainer_id}
              onChange={e => setForm(f => ({ ...f, trainer_id: e.target.value }))}
              className="field num"
            />
          </Field>
          {clubs.length > 1 && (
            <Field label="Club" htmlFor="am-club">
              <select
                id="am-club"
                value={form.club_id}
                onChange={e => setForm(f => ({ ...f, club_id: e.target.value }))}
                className="field"
              >
                {clubs.map(c => (
                  <option key={c.club_id} value={c.club_id}>{c.club_name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Join date" htmlFor="am-join" hint="Quota is counted from this day.">
            <input
              id="am-join"
              type="date"
              value={form.join_date}
              onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))}
              className="field num"
            />
          </Field>

          {error && <p className="rounded-[10px] bg-bad/10 px-3 py-2 text-[13px] text-bad" role="alert">{error}</p>}
        </form>
      </Modal>
    </>
  )
}
