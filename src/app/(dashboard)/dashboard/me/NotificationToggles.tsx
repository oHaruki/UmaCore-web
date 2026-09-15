'use client'

import { useState } from 'react'

type Key = 'notify_on_bombs' | 'notify_on_deficit'

const OPTIONS: { key: Key; label: string; desc: string }[] = [
  { key: 'notify_on_bombs',   label: 'Bomb warnings',  desc: 'A DM when a bomb starts and when it is defused' },
  { key: 'notify_on_deficit', label: 'Deficit alerts', desc: 'A DM after each daily check while you are behind quota' },
]

export default function NotificationToggles({
  initial,
}: {
  initial: Record<Key, boolean>
}) {
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState<Key | null>(null)
  const [error, setError]   = useState<string | null>(null)

  async function toggle(key: Key) {
    const next = !values[key]
    setValues(v => ({ ...v, [key]: next }))
    setSaving(key)
    setError(null)
    try {
      const res = await fetch('/api/me/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not save')
      }
    } catch (e) {
      setValues(v => ({ ...v, [key]: !next }))
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
        <p className="text-sm font-medium text-white">Discord DMs</p>
        {error && <span className="text-[10px] text-red-400">{error}</span>}
      </div>
      <div className="divide-y divide-white/5">
        {OPTIONS.map(({ key, label, desc }) => (
          <label key={key} className="flex items-center justify-between gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02]">
            <div>
              <p className="text-xs font-medium text-zinc-300">{label}</p>
              <p className="text-[11px] text-zinc-600">{desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={values[key]}
              disabled={saving === key}
              onClick={() => toggle(key)}
              className={`relative shrink-0 w-9 h-5 rounded-full transition-colors disabled:opacity-60 ${
                values[key] ? 'bg-violet-600' : 'bg-white/10'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                values[key] ? 'translate-x-4' : ''
              }`} />
            </button>
          </label>
        ))}
      </div>
    </div>
  )
}
