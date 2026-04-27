'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Club, QuotaReq } from './page'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function ClubDetail({ club, quotaHistory }: { club: Club; quotaHistory: QuotaReq[] }) {
  // Lift boolean states so UI reflects changes immediately without page refresh
  const [isActive, setIsActive]         = useState(club.is_active)
  const [bombsEnabled, setBombsEnabled] = useState(club.bombs_enabled)
  const [status, setStatus]             = useState<Record<string, SaveStatus>>({})

  const save = useCallback(async (fields: Record<string, unknown>, key: string) => {
    setStatus(s => ({ ...s, [key]: 'saving' }))
    try {
      const res = await fetch(`/api/clubs/${club.club_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error()
      setStatus(s => ({ ...s, [key]: 'saved' }))
      setTimeout(() => setStatus(s => ({ ...s, [key]: 'idle' })), 2000)
    } catch {
      setStatus(s => ({ ...s, [key]: 'error' }))
      setTimeout(() => setStatus(s => ({ ...s, [key]: 'idle' })), 3000)
    }
  }, [club.club_id])

  const fs = (key: string): SaveStatus => status[key] ?? 'idle'

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-lg px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          <h2 className="text-base font-semibold text-white">{club.club_name}</h2>
          {club.guild_id && <span className="text-[10px] text-zinc-600">Guild {club.guild_id}</span>}
        </div>
        <Toggle
          on={isActive}
          label={isActive ? 'Active' : 'Inactive'}
          saving={fs('is_active') === 'saving'}
          onChange={v => { setIsActive(v); save({ is_active: v }, 'is_active') }}
          savedStatus={fs('is_active')}
        />
      </div>

      {/* Identity */}
      <Section title="Identity">
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Scrape URL"
            value={club.scrape_url ?? ''}
            savedStatus={fs('scrape_url')}
            onSave={v => save({ scrape_url: v || null }, 'scrape_url')}
          />
          <TextField
            label="Circle ID"
            value={club.circle_id ?? ''}
            savedStatus={fs('circle_id')}
            onSave={v => save({ circle_id: v || null }, 'circle_id')}
          />
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
          <ReadField label="Guild ID (Discord server)" value={club.guild_id} mono />
          <ReadField label="Club ID (for support)" value={club.club_id} mono />
        </div>
      </Section>

      {/* Quota */}
      <Section title="Quota">
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Period"
            value={club.quota_period}
            options={[
              { value: 'daily',     label: 'Daily' },
              { value: 'weekly',    label: 'Weekly' },
              { value: 'bi-weekly', label: 'Bi-weekly' },
            ]}
            savedStatus={fs('quota_period')}
            onChange={v => save({ quota_period: v }, 'quota_period')}
          />
          <NumberField
            label="Daily quota"
            value={Number(club.daily_quota)}
            savedStatus={fs('daily_quota')}
            onSave={v => save({ daily_quota: v }, 'daily_quota')}
          />
          <TextField
            label="Timezone"
            value={club.timezone}
            savedStatus={fs('timezone')}
            onSave={v => save({ timezone: v }, 'timezone')}
          />
          <TimeField
            label="Scrape time"
            value={club.scrape_time}
            savedStatus={fs('scrape_time')}
            onSave={v => save({ scrape_time: v }, 'scrape_time')}
          />
        </div>
      </Section>

      {/* Bomb system */}
      <Section title="Bomb system">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-300">Enable bombs</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                Members who fall behind trigger a countdown to removal
              </p>
            </div>
            <Toggle
              on={bombsEnabled}
              label={bombsEnabled ? 'Enabled' : 'Disabled'}
              saving={fs('bombs_enabled') === 'saving'}
              onChange={v => { setBombsEnabled(v); save({ bombs_enabled: v }, 'bombs_enabled') }}
              savedStatus={fs('bombs_enabled')}
            />
          </div>

          <div className={`grid grid-cols-2 gap-4 transition-opacity duration-200 ${!bombsEnabled ? 'opacity-40 pointer-events-none select-none' : ''}`}>
            <NumberField
              label="Trigger — days behind"
              value={club.bomb_trigger_days}
              savedStatus={fs('bomb_trigger_days')}
              onSave={v => save({ bomb_trigger_days: v }, 'bomb_trigger_days')}
              hint="Consecutive days behind quota before bomb activates"
            />
            <NumberField
              label="Countdown — days to recover"
              value={club.bomb_countdown_days}
              savedStatus={fs('bomb_countdown_days')}
              onSave={v => save({ bomb_countdown_days: v }, 'bomb_countdown_days')}
              hint="Days the member has to get back on track"
            />
          </div>
        </div>
      </Section>

      {/* Discord channels */}
      <Section title="Discord channels">
        <div className="space-y-4">
          <ChannelField
            label="Report channel"
            description="Daily quota reports are posted here"
            value={club.report_channel_id}
            savedStatus={fs('report_channel_id')}
            onSave={v => save({ report_channel_id: v || null }, 'report_channel_id')}
          />
          <ChannelField
            label="Alert channel"
            description="Bomb activations and kick alerts"
            value={club.alert_channel_id}
            savedStatus={fs('alert_channel_id')}
            onSave={v => save({ alert_channel_id: v || null }, 'alert_channel_id')}
          />
          <ChannelField
            label="Monthly info channel"
            description="Monthly summary board is posted and updated here"
            value={club.monthly_info_channel_id}
            savedStatus={fs('monthly_info_channel_id')}
            onSave={v => save({ monthly_info_channel_id: v || null }, 'monthly_info_channel_id')}
          />
        </div>
      </Section>

      {/* Quota requirement history */}
      <QuotaRequirementsManager clubId={club.club_id} initialHistory={quotaHistory} />
    </div>
  )
}

// ── Quota requirements manager ─────────────────────────────────
function QuotaRequirementsManager({ clubId, initialHistory }: { clubId: string; initialHistory: QuotaReq[] }) {
  const router = useRouter()
  const [history, setHistory] = useState<QuotaReq[]>(initialHistory)
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [addStatus, setAddStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [recalcStatus, setRecalcStatus] = useState<'idle' | 'recalculating' | 'done'>('idle')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayDay = now.getDate()
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  // Only plot entries that fall in the current month
  const thisMonth = history
    .filter(q => {
      const d = new Date(q.effective_date + 'T00:00:00')
      return d.getFullYear() === year && d.getMonth() === month
    })
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date))

  const dayPct = (day: number) =>
    daysInMonth <= 1 ? 0 : ((day - 1) / (daysInMonth - 1)) * 100

  const showRecalc = () => {
    setRecalcStatus('recalculating')
    setTimeout(() => setRecalcStatus('done'), 1500)
    setTimeout(() => setRecalcStatus('idle'), 3500)
  }

  const handleAdd = async () => {
    const quota = Number(amount)
    if (!date || isNaN(quota) || quota <= 0) return
    setAddStatus('saving')
    try {
      const res = await fetch('/api/quota-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: clubId, effective_date: date, daily_quota: quota }),
      })
      if (!res.ok) throw new Error()
      const { id } = await res.json()
      const newEntry: QuotaReq = { id, effective_date: date, daily_quota: String(quota), set_by: null }
      setHistory(h => [newEntry, ...h].sort((a, b) => b.effective_date.localeCompare(a.effective_date)))
      setDate('')
      setAmount('')
      setAddStatus('idle')
      showRecalc()
      router.refresh()
    } catch {
      setAddStatus('error')
      setTimeout(() => setAddStatus('idle'), 3000)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch('/api/quota-requirements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, club_id: clubId }),
      })
      if (!res.ok) throw new Error()
      setHistory(h => h.filter(q => q.id !== id))
      showRecalc()
      router.refresh()
    } catch {
      // leave in place on error
    } finally {
      setDeletingId(null)
    }
  }

  const parsedAmount = Number(amount)

  return (
    <Section title={`Quota changes — ${monthLabel}`}>

      {/* ── Timeline ── */}
      <div className="relative select-none" style={{ height: '96px' }}>

        {/* Base line */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />

        {/* End caps */}
        <div className="absolute top-1/2 left-0 w-px h-3 -translate-y-1/2 bg-white/20" />
        <div className="absolute top-1/2 right-0 w-px h-3 -translate-y-1/2 bg-white/20" />

        {/* Today marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: `${dayPct(todayDay)}%` }}
        >
          <div className="w-px h-5 bg-zinc-500 -translate-x-1/2" />
          <span className="absolute top-6 left-1/2 -translate-x-1/2 text-[9px] text-zinc-600 whitespace-nowrap">today</span>
        </div>

        {/* Month day labels at ends */}
        <div className="absolute bottom-0 left-0 text-[9px] text-zinc-700">1</div>
        <div className="absolute bottom-0 right-0 text-[9px] text-zinc-700">{daysInMonth}</div>

        {/* No changes message */}
        {thisMonth.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-zinc-700">No changes this month</span>
          </div>
        )}

        {/* Quota change markers */}
        {thisMonth.map((q, i) => {
          const day = new Date(q.effective_date + 'T00:00:00').getDate()
          const pct = dayPct(day)
          const above = i % 2 === 0

          return (
            <div
              key={q.id}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 group ${deletingId === q.id ? 'opacity-30' : ''}`}
              style={{ left: `${pct}%` }}
            >
              {/* Dot */}
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500 ring-2 ring-[#0d0d14] relative z-10" />

              {/* Label — alternates above / below */}
              <div
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center pointer-events-none"
                style={above ? { bottom: '14px' } : { top: '14px' }}
              >
                <p className="text-[10px] font-semibold text-white leading-tight">
                  {formatFans(Number(q.daily_quota))}
                </p>
                <p className="text-[9px] text-zinc-500 leading-tight">{q.set_by ?? `Apr ${day}`}</p>
              </div>

              {/* Delete button — appears on hover */}
              <button
                onClick={() => handleDelete(q.id)}
                disabled={deletingId !== null}
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] leading-none items-center justify-center hidden group-hover:flex z-20 disabled:opacity-0 transition-opacity"
                title="Remove"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Add form ── */}
      <div className="border-t border-white/5 pt-4 flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <label className="text-xs text-zinc-500 block mb-1.5">Effective date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors [color-scheme:dark]"
          />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-xs text-zinc-500 block mb-1.5">
            Daily quota
            {!isNaN(parsedAmount) && parsedAmount > 0 && (
              <span className="ml-2 text-zinc-600">{formatFans(parsedAmount)}</span>
            )}
          </label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="e.g. 500000"
            className="w-full bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors placeholder:text-zinc-700"
          />
        </div>
        <div className="shrink-0 flex items-center gap-2 pb-0.5">
          <button
            onClick={handleAdd}
            disabled={addStatus === 'saving' || !date || isNaN(parsedAmount) || parsedAmount <= 0}
            className="px-3 py-2 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            {addStatus === 'saving' ? 'Adding…' : 'Add'}
          </button>
          {addStatus === 'error' && <span className="text-[10px] text-red-400">error</span>}
          {recalcStatus === 'recalculating' && <span className="text-[10px] text-zinc-500">recalculating…</span>}
          {recalcStatus === 'done' && <span className="text-[10px] text-emerald-500">recalculated</span>}
        </div>
      </div>
    </Section>
  )
}

// ── Section ────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5">
        <p className="text-xs font-medium text-zinc-400">{title}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

// ── Read-only display field ────────────────────────────────────
function ReadField({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1.5">{label}</p>
      <p className={`text-sm text-zinc-300 truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value ?? <span className="text-zinc-600">—</span>}
      </p>
    </div>
  )
}

// ── Toggle ─────────────────────────────────────────────────────
function Toggle({ on, label, onChange, saving, savedStatus }: {
  on: boolean; label: string; saving: boolean
  onChange: (v: boolean) => void
  savedStatus: SaveStatus
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <button
        onClick={() => onChange(!on)}
        disabled={saving}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 disabled:opacity-60 ${on ? 'bg-violet-600' : 'bg-white/10'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-4' : 'left-0.5'}`} />
      </button>
      <SaveIndicator status={savedStatus} />
    </div>
  )
}

// ── Text field (auto-save on blur) ─────────────────────────────
function TextField({ label, value, onSave, savedStatus }: {
  label: string; value: string
  onSave: (v: string) => void
  savedStatus: SaveStatus
}) {
  const [local, setLocal] = useState(value)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-zinc-500">{label}</label>
        <SaveIndicator status={savedStatus} />
      </div>
      <input
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onSave(local) }}
        className="w-full bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors"
      />
    </div>
  )
}

// ── Number field (auto-save on blur) ──────────────────────────
function NumberField({ label, value, onSave, hint, savedStatus }: {
  label: string; value: number; hint?: string
  onSave: (v: number) => void
  savedStatus: SaveStatus
}) {
  const [local, setLocal] = useState(String(value))
  const parsed = Number(local)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-zinc-500">{label}</label>
        <SaveIndicator status={savedStatus} />
      </div>
      <input
        type="number"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (!isNaN(parsed) && parsed !== value) onSave(parsed) }}
        className="w-full bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors"
      />
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
      {!isNaN(parsed) && parsed !== value && (
        <p className="text-[10px] text-zinc-600 mt-1">{formatFans(parsed)}</p>
      )}
    </div>
  )
}

// ── Time field (auto-save on blur) ────────────────────────────
function TimeField({ label, value, onSave, savedStatus }: {
  label: string; value: string
  onSave: (v: string) => void
  savedStatus: SaveStatus
}) {
  const initial = value.slice(0, 5)
  const [local, setLocal] = useState(initial)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-zinc-500">{label}</label>
        <SaveIndicator status={savedStatus} />
      </div>
      <input
        type="time"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== initial) onSave(local + ':00') }}
        className="w-full bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors"
      />
    </div>
  )
}

// ── Select field (instant save) ────────────────────────────────
function SelectField({ label, value, options, onChange, savedStatus }: {
  label: string; value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  savedStatus: SaveStatus
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-zinc-500">{label}</label>
        <SaveIndicator status={savedStatus} />
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Channel field ──────────────────────────────────────────────
function ChannelField({ label, description, value, onSave, savedStatus }: {
  label: string; description: string; value: string | null
  onSave: (v: string) => void
  savedStatus: SaveStatus
}) {
  const [local, setLocal] = useState(value ?? '')
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm text-zinc-300">{label}</p>
          <SaveIndicator status={savedStatus} />
        </div>
        <p className="text-xs text-zinc-600">{description}</p>
      </div>
      <div className="w-52 shrink-0">
        <input
          value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => { if (local !== (value ?? '')) onSave(local) }}
          placeholder="Channel ID"
          className="w-full bg-[#111118] border border-white/5 rounded px-3 py-2 text-xs text-white font-mono outline-none focus:border-white/20 transition-colors placeholder:text-zinc-700"
        />
      </div>
    </div>
  )
}

// ── Save indicator ─────────────────────────────────────────────
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle')   return null
  if (status === 'saving') return <span className="text-[10px] text-zinc-600">saving…</span>
  if (status === 'saved')  return <span className="text-[10px] text-emerald-500">saved</span>
  if (status === 'error')  return <span className="text-[10px] text-red-400">error</span>
  return null
}

function formatFans(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${(abs / 1_000).toFixed(0)}K`
  return String(n)
}
