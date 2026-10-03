'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Plus } from 'lucide-react'
import Modal, { Field, Switch } from '@/components/dash/Modal'

// Values must match the bot exactly — services/quota_calculator.py looks the period
// up in {'daily': 1, 'weekly': 7, 'biweekly': 14} and silently falls back to daily
// on anything else, so a mismatch here quietly turns a 14-day quota into a daily one.
const PERIODS = [
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
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

  const refresh = (
    <button
      type="button"
      onClick={() => signIn('discord', { callbackUrl: '/dashboard/settings' })}
      className="link"
    >
      Refresh server list
    </button>
  )

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus size={16} strokeWidth={2} />
        Add club
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a club"
        description="Connect an Uma Musume club to one of your Discord servers."
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
            <button type="submit" form="add-club-form" disabled={saving} className="btn btn-primary">
              {saving ? 'Creating…' : 'Create club'}
            </button>
          </>
        }
      >
        <form id="add-club-form" onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Club name" htmlFor="ac-name">
              <input id="ac-name" required value={form.club_name} onChange={e => set('club_name', e.target.value)}
                placeholder="e.g. Turfcore" className="field" />
            </Field>
            <Field
              label="Discord server"
              htmlFor="ac-guild"
              hint={adminGuilds.length === 0
                ? <>No servers found. {refresh}</>
                : <>Server missing? {refresh} or <a href={BOT_INVITE_URL} target="_blank" rel="noopener noreferrer" className="link">invite the bot</a>.</>}
            >
              <select id="ac-guild" required value={form.guild_id} onChange={e => set('guild_id', e.target.value)} className="field">
                <option value="" disabled>Select a server</option>
                {adminGuilds.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Circle ID"
              htmlFor="ac-circle"
              hint={<>Digits only, from the end of your <a href="https://uma.moe/circles/" target="_blank" rel="noopener noreferrer" className="link">uma.moe</a> circle URL. Without it the club falls back to the slower ChronoGenesis scraper.</>}
            >
              <input id="ac-circle" required inputMode="numeric" pattern="[0-9]+" value={form.circle_id}
                onChange={e => set('circle_id', e.target.value)}
                placeholder="e.g. 860280110" className="field num" />
            </Field>
            <Field label="Scrape URL (optional)" htmlFor="ac-scrape">
              <input id="ac-scrape" value={form.scrape_url} onChange={e => set('scrape_url', e.target.value)}
                placeholder="ChronoGenesis URL" className="field" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Quota" htmlFor="ac-quota" hint="Fan goal per period, not necessarily per day.">
              <input id="ac-quota" required type="number" value={form.daily_quota} onChange={e => set('daily_quota', e.target.value)}
                placeholder="e.g. 1000000" min={0} className="field num" />
            </Field>
            <Field label="Quota period" htmlFor="ac-period">
              <select id="ac-period" value={form.quota_period} onChange={e => set('quota_period', e.target.value)} className="field">
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Timezone" htmlFor="ac-tz">
              <input id="ac-tz" value={form.timezone} onChange={e => set('timezone', e.target.value)}
                placeholder="e.g. Europe/Amsterdam" className="field" />
            </Field>
            <Field label="Daily check time" htmlFor="ac-time">
              <input id="ac-time" type="time" value={form.scrape_time} onChange={e => set('scrape_time', e.target.value)} className="field num" />
            </Field>
          </div>

          <div className="panel-inset space-y-4 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-fg">Bombs</p>
                <p className="text-xs text-fg-subtle">Start a countdown for members who stay behind.</p>
              </div>
              <Switch checked={form.bombs_enabled} onChange={v => set('bombs_enabled', v)} label="Enable bombs" />
            </div>
            {form.bombs_enabled && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Trigger after (days behind)" htmlFor="ac-trigger">
                  <input id="ac-trigger" type="number" value={form.bomb_trigger_days} onChange={e => set('bomb_trigger_days', e.target.value)}
                    min={1} className="field num" />
                </Field>
                <Field label="Countdown (days)" htmlFor="ac-countdown">
                  <input id="ac-countdown" type="number" value={form.bomb_countdown_days} onChange={e => set('bomb_countdown_days', e.target.value)}
                    min={1} className="field num" />
                </Field>
              </div>
            )}
          </div>

          {error && <p className="rounded-[10px] bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
        </form>
      </Modal>
    </>
  )
}

const BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1467295225184784488&permissions=83968&integration_type=0&scope=bot+applications.commands'
