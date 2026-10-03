'use client'

import { useState } from 'react'
import { Switch } from '@/components/dash/Modal'

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
    <section className="panel overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-fg">Discord DMs</h2>
          <p className="mt-0.5 text-[13px] text-fg-subtle">Same settings as /notification_settings</p>
        </div>
        {error && <span className="text-xs text-bad" role="alert">{error}</span>}
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {OPTIONS.map(({ key, label, desc }) => (
          <li key={key} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <p className="text-[13px] font-medium text-fg-soft">{label}</p>
              <p className="text-xs text-fg-subtle">{desc}</p>
            </div>
            <Switch checked={values[key]} onChange={() => toggle(key)} disabled={saving === key} label={label} />
          </li>
        ))}
      </ul>
    </section>
  )
}
