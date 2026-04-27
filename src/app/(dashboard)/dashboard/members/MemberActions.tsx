'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MemberToggle({
  memberId,
  isActive,
}: {
  memberId: string
  isActive: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    await fetch(`/api/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive, manually_deactivated: isActive }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="text-xs text-zinc-500 hover:text-white disabled:opacity-40 transition-colors px-2 py-1 rounded hover:bg-white/5"
    >
      {loading ? '…' : isActive ? 'Deactivate' : 'Activate'}
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
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded transition-colors"
      >
        Add member
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0d0d14] border border-white/8 rounded-lg w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Add member</p>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
            </div>

            <form onSubmit={submit} className="px-5 py-5 space-y-4">
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Trainer name</label>
                <input
                  required
                  value={form.trainer_name}
                  onChange={e => setForm(f => ({ ...f, trainer_name: e.target.value }))}
                  placeholder="e.g. Gwiyomi"
                  className="w-full bg-[#111118] border border-white/8 rounded px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 transition-colors placeholder:text-zinc-700"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Trainer ID</label>
                <input
                  required
                  value={form.trainer_id}
                  onChange={e => setForm(f => ({ ...f, trainer_id: e.target.value }))}
                  placeholder="Game trainer ID"
                  className="w-full bg-[#111118] border border-white/8 rounded px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 transition-colors placeholder:text-zinc-700"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Club</label>
                <select
                  value={form.club_id}
                  onChange={e => setForm(f => ({ ...f, club_id: e.target.value }))}
                  className="w-full bg-[#111118] border border-white/8 rounded px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 transition-colors"
                >
                  {clubs.map(c => (
                    <option key={c.club_id} value={c.club_id}>{c.club_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Join date</label>
                <input
                  type="date"
                  value={form.join_date}
                  onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))}
                  className="w-full bg-[#111118] border border-white/8 rounded px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="text-xs text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 rounded transition-colors">
                  {saving ? 'Adding…' : 'Add member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
