'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

const PERIODS = [
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
]

export default function AddClubButton({ adminGuilds }: { adminGuilds: { id: string; name: string }[] }) {
  const [open, setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]  = useState<string | null>(null)
  const router = useRouter()

  const [form, setForm] = useState({
    club_name:           '',
    scrape_url:          '',
    circle_id:           '',
    guild_id:            '',
    daily_quota:         '',
    quota_period:        'daily',
    timezone:            'Europe/Amsterdam',
    scrape_time:         '16:00',
    bombs_enabled:       true,
    bomb_trigger_days:   '3',
    bomb_countdown_days: '7',
  })

  function set(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          daily_quota:         Number(form.daily_quota),
          bomb_trigger_days:   Number(form.bomb_trigger_days),
          bomb_countdown_days: Number(form.bomb_countdown_days),
          scrape_time:         form.scrape_time + ':00',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create club')
      // Make the new club the active one so Settings opens on it.
      await fetch('/api/active-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: data.club_id }),
      })
      setOpen(false)
      router.push('/dashboard/settings')
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
        className="w-full mt-2 px-3 py-2 text-xs text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left border border-dashed border-white/10 hover:border-white/20"
      >
        + Add club
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#0d0d14] border border-white/8 rounded-lg w-full max-w-lg mx-4 overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Add club</p>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-lg leading-none">×</button>
            </div>

            <form onSubmit={submit} className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Club name *">
                  <input required value={form.club_name} onChange={e => set('club_name', e.target.value)}
                    placeholder="e.g. Turfcore" className={inputCls} />
                </Field>
                <Field label="Discord server *">
                  <select
                    required
                    value={form.guild_id}
                    onChange={e => set('guild_id', e.target.value)}
                    className={inputCls}
                  >
                    <option value="" disabled>Select a server</option>
                    {adminGuilds.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  {adminGuilds.length === 0 && (
                    <p className="mt-1.5 text-[10px] text-zinc-600">
                      No servers found.{' '}
                      <button
                        type="button"
                        onClick={() => signIn('discord', { callbackUrl: '/dashboard/settings' })}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Refresh server list
                      </button>
                    </p>
                  )}
                  {adminGuilds.length > 0 && (
                    <p className="mt-1.5 text-[10px] text-zinc-600">
                      Server missing?{' '}
                      <button
                        type="button"
                        onClick={() => signIn('discord', { callbackUrl: '/dashboard/settings' })}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Refresh server list
                      </button>
                      {' '}·{' '}
                      <a
                        href="https://discord.com/oauth2/authorize?client_id=1467295225184784488&permissions=83968&integration_type=0&scope=bot+applications.commands"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Invite bot
                      </a>
                    </p>
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Scrape URL">
                  <input value={form.scrape_url} onChange={e => set('scrape_url', e.target.value)}
                    placeholder="Uma.moe circle URL" className={inputCls} />
                </Field>
                <Field label="Circle ID">
                  <input value={form.circle_id} onChange={e => set('circle_id', e.target.value)}
                    placeholder="Game circle ID" className={inputCls} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Daily quota *">
                  <input required type="number" value={form.daily_quota} onChange={e => set('daily_quota', e.target.value)}
                    placeholder="e.g. 1000000" min={0} className={inputCls} />
                </Field>
                <Field label="Quota period">
                  <select value={form.quota_period} onChange={e => set('quota_period', e.target.value)} className={inputCls}>
                    {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Timezone">
                  <input value={form.timezone} onChange={e => set('timezone', e.target.value)}
                    placeholder="e.g. Europe/Amsterdam" className={inputCls} />
                </Field>
                <Field label="Scrape time">
                  <input type="time" value={form.scrape_time} onChange={e => set('scrape_time', e.target.value)} className={inputCls} />
                </Field>
              </div>

              <div className="pt-1 border-t border-white/5">
                <p className="text-xs text-zinc-500 mb-3">Bomb settings</p>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Enable bombs">
                    <button type="button" onClick={() => set('bombs_enabled', !form.bombs_enabled)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${form.bombs_enabled ? 'bg-violet-600' : 'bg-white/10'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.bombs_enabled ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </Field>
                  <Field label="Trigger (days behind)">
                    <input type="number" value={form.bomb_trigger_days} onChange={e => set('bomb_trigger_days', e.target.value)}
                      min={1} className={inputCls} />
                  </Field>
                  <Field label="Countdown (days)">
                    <input type="number" value={form.bomb_countdown_days} onChange={e => set('bomb_countdown_days', e.target.value)}
                      min={1} className={inputCls} />
                  </Field>
                </div>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                  {saving ? 'Creating…' : 'Create club'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1.5">{label}</p>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-[#111118] border border-white/8 rounded px-3 py-2 text-sm text-white outline-none focus:border-violet-500/40 transition-colors placeholder:text-zinc-700'
