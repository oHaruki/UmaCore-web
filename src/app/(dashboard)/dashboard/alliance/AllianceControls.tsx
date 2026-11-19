'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import Modal, { Field, Switch } from '@/components/dash/Modal'
import { Chip, Panel } from '@/components/dash/ui'
import CopyButton from '@/components/recruiting/CopyButton'
import type { Alliance } from '@/lib/alliance'

const NAME_MAX = 40

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? 'Something went wrong')
  return j
}

const PUBLIC_NOTE = 'If the owner makes the leaderboard public, trainer names and fan counts of every club in it can be seen by anyone with the link.'

export function AllianceSetup({ clubId, clubName }: { clubId: string; clubName: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [errors, setErrors] = useState<{ create?: string; join?: string }>({})

  async function run(kind: 'create' | 'join') {
    setBusy(kind)
    setErrors({})
    try {
      if (kind === 'create') await send('/api/alliances', 'POST', { club_id: clubId, name })
      else await send('/api/alliances/join', 'POST', { club_id: clubId, code })
      router.refresh()
    } catch (e) {
      setErrors({ [kind]: e instanceof Error ? e.message : 'Something went wrong' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Start an alliance" description={`${clubName} becomes the owner club and gets a code to share.`}>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); run('create') }}>
          <Field label="Alliance name" htmlFor="alliance-name" error={errors.create} hint="Shown on the leaderboard and in /alliance.">
            <input
              id="alliance-name" className="field" maxLength={NAME_MAX} value={name}
              onChange={e => setName(e.target.value)} placeholder="Horsecore Family"
            />
          </Field>
          <button className="btn btn-primary" disabled={busy !== null || name.trim().length < 2}>
            {busy === 'create' ? 'Creating…' : 'Create alliance'}
          </button>
        </form>
      </Panel>

      <Panel title="Join with a code" description="Ask the owner club's managers for their alliance code.">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); run('join') }}>
          <Field label="Alliance code" htmlFor="alliance-code" error={errors.join} hint={PUBLIC_NOTE}>
            <input
              id="alliance-code" className="field font-mono uppercase tracking-[0.2em]" maxLength={12} value={code}
              onChange={e => setCode(e.target.value)} placeholder="ABCD2345" autoComplete="off"
            />
          </Field>
          <button className="btn btn-secondary" disabled={busy !== null || code.trim().length < 4}>
            {busy === 'join' ? 'Joining…' : `Join with ${clubName}`}
          </button>
        </form>
      </Panel>
    </div>
  )
}

type ManagedClub = { club_id: string; club_name: string; is_owner: boolean; can_leave: boolean }
type Confirm = { kind: 'remove'; club: ManagedClub } | { kind: 'disband' }

export function AllianceManager({
  alliance, clubs, isOwner, activeClubId,
}: {
  alliance: Alliance
  clubs: ManagedClub[]
  isOwner: boolean
  activeClubId: string
}) {
  const router = useRouter()
  const [name, setName] = useState(alliance.name)
  const [isPublic, setIsPublic] = useState(alliance.is_public)
  const [code, setCode] = useState(alliance.invite_code)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const base = `/api/alliances/${alliance.alliance_id}`

  async function act(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const patch = (body: Record<string, unknown>) => act(async () => {
    const j = await send(base, 'PATCH', body)
    setCode(j.invite_code)
  })

  const removeClub = (c: ManagedClub) => act(async () => {
    await send(`${base}/clubs/${c.club_id}`, 'DELETE')
    setConfirm(null)
  })

  const disband = () => act(async () => {
    await send(base, 'DELETE')
    setConfirm(null)
  })

  const target = confirm?.kind === 'remove' ? confirm.club : null
  const selfLeave = !!target?.can_leave

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel title="Clubs" description={`${clubs.length} in this alliance`} flush>
        <ul className="divide-y divide-line border-t border-line">
          {clubs.map(c => (
            <li key={c.club_id} className="flex items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg-soft">{c.club_name}</span>
              {c.is_owner && <Chip tone="brand">Owner</Chip>}
              {c.club_id === activeClubId && <Chip>This club</Chip>}
              {(c.can_leave || isOwner) && (
                <button className="btn btn-danger-ghost btn-xs" onClick={() => setConfirm({ kind: 'remove', club: c })}>
                  {c.can_leave ? 'Leave' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {isOwner ? (
        <Panel title="Settings" description="Only managers of the owner club see this.">
          <div className="space-y-5">
            <Field label="Invite code" hint="Other clubs join with this on their Alliance page. A new code stops the old one working.">
              <div className="flex flex-wrap items-center gap-2">
                <code className="panel-inset px-3 py-1.5 font-mono text-[15px] tracking-[0.2em] text-fg">{code}</code>
                <CopyButton value={code} label="Copy" className="btn btn-secondary btn-sm" />
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => patch({ new_code: true })}>
                  <RefreshCw size={14} strokeWidth={1.75} /> New code
                </button>
              </div>
            </Field>

            <Field label="Name" htmlFor="alliance-rename">
              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); patch({ name }) }}>
                <input id="alliance-rename" className="field" maxLength={NAME_MAX} value={name} onChange={e => setName(e.target.value)} />
                <button className="btn btn-secondary" disabled={busy || name.trim() === alliance.name || name.trim().length < 2}>Save</button>
              </form>
            </Field>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-fg-soft">Public leaderboard</p>
                <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">
                  Anyone with the link can see it, no sign in needed. /alliance in Discord links to it.
                </p>
              </div>
              <Switch
                checked={isPublic} disabled={busy} label="Public leaderboard"
                onChange={next => { setIsPublic(next); patch({ is_public: next }) }}
              />
            </div>

            <div className="border-t border-line pt-4">
              <button className="btn btn-danger-ghost btn-sm" onClick={() => setConfirm({ kind: 'disband' })}>
                Disband alliance
              </button>
            </div>
            {error && <p className="text-xs text-bad">{error}</p>}
          </div>
        </Panel>
      ) : (
        <Panel title="Settings">
          <p className="text-[13px] leading-relaxed text-fg-muted">
            The owner club&apos;s managers handle the name, invite code and whether the leaderboard is public.
            {alliance.is_public ? ' It is public right now.' : ' It is private right now.'}
          </p>
          {error && <p className="mt-3 text-xs text-bad">{error}</p>}
        </Panel>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === 'disband' ? `Disband ${alliance.name}?`
            : selfLeave ? `Take ${target?.club_name} out of ${alliance.name}?`
            : `Remove ${target?.club_name}?`
        }
        description={
          confirm?.kind === 'disband'
            ? 'Every club leaves and the shared leaderboard is gone. Club data is not touched.'
            : target?.is_owner && clubs.length > 1
              ? 'This is the owner club, so the next oldest club takes over the settings.'
              : clubs.length === 1
                ? 'It is the last club, so the alliance is deleted.'
                : 'It can join again later with the invite code.'
        }
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button
              className="btn btn-danger" disabled={busy}
              onClick={() => (confirm?.kind === 'disband' ? disband() : target && removeClub(target))}
            >
              {confirm?.kind === 'disband' ? 'Disband' : selfLeave ? 'Leave' : 'Remove'}
            </button>
          </>
        }
      >
        {error && <p className="text-xs text-bad">{error}</p>}
      </Modal>
    </div>
  )
}
