'use client'

import { useEffect, useState, useCallback } from 'react'

type GuildRole = { id: string; name: string; color: number; position: number; managed: boolean }

type State = {
  loading: boolean
  botReachable: boolean
  editors: string[]
  roles: GuildRole[]
  error: string | null
}

function roleColor(color: number): string {
  if (!color) return '#a1a1aa' // zinc-400 for the default (colorless) role
  return `#${color.toString(16).padStart(6, '0')}`
}

export default function ClubEditors({ clubId }: { clubId: string }) {
  const [state, setState] = useState<State>({
    loading: true,
    botReachable: true,
    editors: [],
    roles: [],
    error: null,
  })
  const [pendingRole, setPendingRole] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/editors`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load editors')
      const data = await res.json()
      setState({
        loading: false,
        botReachable: !!data.bot_reachable,
        editors: data.editors ?? [],
        roles: data.roles ?? [],
        error: null,
      })
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Could not load editor roles' }))
    }
  }, [clubId])

  useEffect(() => { load() }, [load])

  const addRole = useCallback(async (roleId: string, roleName?: string) => {
    if (!roleId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/editors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, role_name: roleName }),
      })
      if (!res.ok) throw new Error()
      setState(s => s.editors.includes(roleId) ? s : { ...s, editors: [...s.editors, roleId] })
      setPendingRole('')
    } catch {
      /* keep UI as-is on failure */
    } finally {
      setBusy(false)
    }
  }, [clubId])

  const removeRole = useCallback(async (roleId: string, roleName?: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/editors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, role_name: roleName }),
      })
      if (!res.ok) throw new Error()
      setState(s => ({ ...s, editors: s.editors.filter(r => r !== roleId) }))
    } catch {
      /* keep UI as-is on failure */
    } finally {
      setBusy(false)
    }
  }, [clubId])

  const roleById = (id: string) => state.roles.find(r => r.id === id)
  const available = state.roles
    .filter(r => !state.editors.includes(r.id))
    .sort((a, b) => b.position - a.position)

  return (
    <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5">
        <p className="text-xs font-medium text-zinc-400">Club editors</p>
      </div>
      <div className="px-5 py-4 space-y-4">
        <p className="text-xs text-zinc-500 leading-relaxed">
          Anyone with one of these roles can manage this club — edit settings, channels, quota and
          members — both here and in Discord. They <span className="text-zinc-400">cannot</span> delete
          the club (admin only). Holding an editor role also lets them create new clubs.
        </p>

        {state.loading ? (
          <p className="text-xs text-zinc-600">Loading…</p>
        ) : state.error ? (
          <p className="text-xs text-red-400">{state.error}</p>
        ) : !state.botReachable ? (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <p className="text-xs text-amber-400">Bot offline</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Can&apos;t load this server&apos;s roles right now. You can still assign editors in Discord
              with <span className="font-mono text-zinc-400">/add_club_editor</span>.
            </p>
          </div>
        ) : (
          <>
            {/* Current editor roles */}
            <div className="flex flex-wrap gap-2">
              {state.editors.length === 0 && (
                <span className="text-xs text-zinc-600">No editor roles yet — only admins can manage this club.</span>
              )}
              {state.editors.map(id => {
                const role = roleById(id)
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: role ? roleColor(role.color) : '#71717a' }} />
                    <span className="text-zinc-200">{role ? role.name : `Unknown role (${id})`}</span>
                    <button
                      onClick={() => removeRole(id, role?.name)}
                      disabled={busy}
                      title="Remove"
                      className="w-4 h-4 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 flex items-center justify-center disabled:opacity-40 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>

            {/* Add a role */}
            <div className="flex items-center gap-2 border-t border-white/5 pt-4">
              <select
                value={pendingRole}
                onChange={e => setPendingRole(e.target.value)}
                disabled={busy || available.length === 0}
                className="flex-1 min-w-0 bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors disabled:opacity-50"
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
                className="px-3 py-2 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors shrink-0"
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
