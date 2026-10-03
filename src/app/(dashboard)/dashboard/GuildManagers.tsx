'use client'

import { useEffect, useState, useCallback } from 'react'

type GuildRole = { id: string; name: string; color: number; position: number; managed: boolean }

type State = {
  loading: boolean
  botReachable: boolean
  managers: string[]
  roles: GuildRole[]
  error: string | null
}

function roleColor(color: number): string {
  if (!color) return '#a1a1aa'
  return `#${color.toString(16).padStart(6, '0')}`
}

export default function GuildManagers({ guildId }: { guildId: string }) {
  const [state, setState] = useState<State>({
    loading: true,
    botReachable: true,
    managers: [],
    roles: [],
    error: null,
  })
  const [pendingRole, setPendingRole] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/managers`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load manager roles')
      const data = await res.json()
      setState({
        loading: false,
        botReachable: !!data.bot_reachable,
        managers: data.managers ?? [],
        roles: data.roles ?? [],
        error: null,
      })
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Could not load manager roles' }))
    }
  }, [guildId])

  useEffect(() => { load() }, [load])

  const addRole = useCallback(async (roleId: string, roleName?: string) => {
    if (!roleId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/guilds/${guildId}/managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, role_name: roleName }),
      })
      if (!res.ok) throw new Error()
      setState(s => s.managers.includes(roleId) ? s : { ...s, managers: [...s.managers, roleId] })
      setPendingRole('')
    } catch {
      /* keep UI as-is */
    } finally {
      setBusy(false)
    }
  }, [guildId])

  const removeRole = useCallback(async (roleId: string, roleName?: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/guilds/${guildId}/managers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, role_name: roleName }),
      })
      if (!res.ok) throw new Error()
      setState(s => ({ ...s, managers: s.managers.filter(r => r !== roleId) }))
    } catch {
      /* keep UI as-is */
    } finally {
      setBusy(false)
    }
  }, [guildId])

  const roleById = (id: string) => state.roles.find(r => r.id === id)
  const available = state.roles
    .filter(r => !state.managers.includes(r.id))
    .sort((a, b) => b.position - a.position)

  return (
    <div className="panel overflow-hidden">
      <div className="px-5 pt-4">
        <h2 className="text-[15px] font-semibold text-fg">Server manager roles</h2>
      </div>
      <div className="px-5 py-4 space-y-4">
        <p className="text-xs text-fg-muted leading-relaxed">
          Anyone with one of these roles can manage <span className="text-fg-muted">every</span> club
          in this server — create, edit, delete, and assign club editors — like a Discord admin.
          They <span className="text-fg-muted">cannot</span> assign manager roles (admins only).
        </p>

        {state.loading ? (
          <p className="text-xs text-fg-subtle">Loading…</p>
        ) : state.error ? (
          <p className="text-xs text-bad">{state.error}</p>
        ) : !state.botReachable ? (
          <div className="rounded border border-warn/20 bg-warn/5 px-3 py-2.5">
            <p className="text-xs text-warn">Bot offline</p>
            <p className="text-xs text-fg-muted mt-0.5">
              Can&apos;t load this server&apos;s roles right now. You can still set managers in Discord
              with <span className="font-mono text-fg-muted">/add_manager_role</span>.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {state.managers.length === 0 && (
                <span className="text-xs text-fg-subtle">No manager roles — only Discord admins manage all clubs.</span>
              )}
              {state.managers.map(id => {
                const role = roleById(id)
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-surface-3 border border-line-strong text-xs"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: role ? roleColor(role.color) : '#71717a' }} />
                    <span className="text-fg-soft">{role ? role.name : `Unknown role (${id})`}</span>
                    <button
                      onClick={() => removeRole(id, role?.name)}
                      disabled={busy}
                      title="Remove"
                      className="w-4 h-4 rounded-full text-fg-muted hover:text-fg hover:bg-surface-3 flex items-center justify-center disabled:opacity-40 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>

            <div className="flex items-center gap-2 border-t border-line pt-4">
              <select
                value={pendingRole}
                onChange={e => setPendingRole(e.target.value)}
                disabled={busy || available.length === 0}
                className="flex-1 min-w-0 bg-surface-2 border border-line-strong rounded-[10px] px-3 py-2 text-sm text-fg outline-none focus:border-brand/60 transition-colors disabled:opacity-50"
              >
                <option value="">
                  {available.length === 0 ? 'All roles already added' : 'Select a role to add…'}
                </option>
                {available.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button
                onClick={() => addRole(pendingRole, roleById(pendingRole)?.name)}
                disabled={busy || !pendingRole}
                className="px-3 py-2 text-xs bg-brand-solid hover:bg-brand-solid-hover disabled:opacity-40 disabled:cursor-not-allowed text-brand-ink rounded transition-colors shrink-0"
              >
                Add
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
