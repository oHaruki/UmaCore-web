'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LANGUAGES, LISTED_DAYS, MAX_LANGUAGES, TAGS, bumpReadyAt } from '@/lib/recruiting-shared'

/** Read once per mount; minutes of drift don't matter for day-long timers. */
function useMountTime() {
  const [now] = useState(() => Date.now())
  return now
}

const chip = (on: boolean) => cn(
  'h-7 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:opacity-40',
  on ? 'border-brand/40 bg-brand/14 text-brand' : 'border-line-strong bg-surface-2 text-fg-muted hover:text-fg'
)

export function TagPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TAGS.map(t => {
        const on = value.includes(t.id)
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter(x => x !== t.id) : [...value, t.id])}
            className={chip(on)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function LanguagePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const full = value.length >= MAX_LANGUAGES
  return (
    <div className="flex flex-wrap gap-1.5">
      {LANGUAGES.map(l => {
        const on = value.includes(l)
        return (
          <button
            key={l}
            type="button"
            aria-pressed={on}
            disabled={!on && full}
            onClick={() => onChange(on ? value.filter(x => x !== l) : [...value, l])}
            className={chip(on)}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

export function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn('num text-[11px]', value.length > max ? 'text-bad' : 'text-fg-subtle')}>
      {value.length}/{max}
    </span>
  )
}

/** Where a saved post stands on the board, and when it can be bumped. */
export function ListingStatus({ exists, isOpen, bumpedAt }: { exists: boolean; isOpen: boolean; bumpedAt: string | null }) {
  const now = useMountTime()
  if (!exists || !bumpedAt) return <span className="chip chip-neutral">Not posted yet</span>
  if (!isOpen) return <span className="chip chip-neutral">Closed, hidden from the board</span>
  const ageDays = (now - new Date(bumpedAt).getTime()) / 86_400_000
  if (ageDays >= LISTED_DAYS) return <span className="chip chip-warn">Expired, bump to list it again</span>
  return (
    <span className="chip chip-good">
      Listed, {Math.ceil(LISTED_DAYS - ageDays)} days left
    </span>
  )
}

type Result = { ok: true } | { ok: false; error: string }

async function call(url: string, method: string, body?: unknown): Promise<Result> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.ok) return { ok: true }
    const j = await res.json().catch(() => ({}))
    return { ok: false, error: j.error ?? `Something went wrong (${res.status})` }
  } catch {
    return { ok: false, error: 'Network error, try again' }
  }
}

/** Save / bump / remove buttons shared by both editors. */
export function PostActions({
  url, exists, bumpedAt, onSave, onDone, saveLabel,
}: {
  url: string
  exists: boolean
  bumpedAt: string | null
  onSave: () => unknown | null // null = form invalid, keep the button quiet
  onDone: (msg: string) => void
  saveLabel: string
}) {
  const [busy, setBusy] = useState<null | 'save' | 'bump' | 'delete'>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const now = useMountTime()
  const bumpAt = bumpedAt ? bumpReadyAt(bumpedAt) : null
  const canBump = exists && bumpAt !== null && bumpAt.getTime() <= now
  const hoursLeft = bumpAt ? Math.ceil((bumpAt.getTime() - now) / 3_600_000) : 0

  async function run(kind: 'save' | 'bump' | 'delete') {
    setError(null)
    let r: Result
    if (kind === 'save') {
      const body = onSave()
      if (body === null) return
      setBusy(kind)
      r = await call(url, 'PUT', body)
    } else {
      setBusy(kind)
      r = await call(url, kind === 'bump' ? 'POST' : 'DELETE')
    }
    setBusy(null)
    setConfirmDelete(false)
    if (!r.ok) setError(r.error)
    else onDone(kind === 'save' ? 'Saved' : kind === 'bump' ? 'Bumped to the top' : 'Removed')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => run('save')} disabled={busy !== null} className="btn btn-primary">
          {busy === 'save' ? 'Saving…' : saveLabel}
        </button>
        {exists && (
          <button
            onClick={() => run('bump')}
            disabled={busy !== null || !canBump}
            className="btn btn-secondary"
            title={canBump ? 'Move your post back to the top' : `You can bump again in ${hoursLeft}h`}
          >
            {busy === 'bump' ? 'Bumping…' : canBump ? 'Bump' : `Bump in ${hoursLeft}h`}
          </button>
        )}
        {exists && (
          <button
            onClick={() => (confirmDelete ? run('delete') : setConfirmDelete(true))}
            onBlur={() => setConfirmDelete(false)}
            disabled={busy !== null}
            className={cn('btn ml-auto', confirmDelete ? 'btn-danger' : 'btn-danger-ghost')}
          >
            {confirmDelete ? 'Click again to remove' : 'Remove post'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  )
}
