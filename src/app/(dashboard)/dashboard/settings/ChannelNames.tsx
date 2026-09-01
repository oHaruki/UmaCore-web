'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type GuildChannel = {
  id: string
  name: string
  type: string
  position: number
  category: string | null
  can_rename: boolean | null
  can_post: boolean
}

type Binding = {
  channel_id: string
  template: string
  enabled: boolean
  last_rendered: string | null
  last_updated: string | null
}

type State = {
  loading: boolean
  botReachable: boolean
  bindings: Binding[]
  channels: GuildChannel[]
  tokens: Record<string, string>
  maxLength: number
  error: string | null
}

// Starting points, so the first thing someone sees is a working example rather
// than an empty box and a token list to assemble one from.
const PRESETS = [
  { label: 'Rank', template: '🏆│Rank #{rank}' },
  { label: 'Rank + movement', template: '🏆│#{rank} ({delta})' },
  { label: 'Monthly fans', template: '📈│{fans} fans' },
  { label: 'Today', template: '⚡│Today {fans_today}' },
  { label: 'Grade', template: '🎖│{grade} · #{rank}' },
]

const TYPE_ICON: Record<string, string> = {
  voice: '🔊', stage: '📣', text: '#', news: '📰', forum: '💬',
}

export default function ChannelNames({ clubId }: { clubId: string }) {
  const [state, setState] = useState<State>({
    loading: true,
    botReachable: true,
    bindings: [],
    channels: [],
    tokens: {},
    maxLength: 100,
    error: null,
  })

  const [channelId, setChannelId] = useState('')
  const [template, setTemplate] = useState(PRESETS[0].template)
  const [preview, setPreview] = useState<string | null>(null)
  const [badTokens, setBadTokens] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [showTokens, setShowTokens] = useState(false)

  // Which binding is open for editing, and the text being edited. A bound
  // channel is filtered out of the picker, so without this the only way to
  // reword a name was to remove the binding and set it up again.
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const templateRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/channel-names`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setState({
        loading: false,
        botReachable: !!data.bot_reachable,
        bindings: data.bindings ?? [],
        channels: data.channels ?? [],
        tokens: data.tokens ?? {},
        maxLength: data.max_length ?? 100,
        error: null,
      })
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Could not load channel names' }))
    }
  }, [clubId])

  useEffect(() => { load() }, [load])

  // Preview is rendered by the bot, which owns the token vocabulary — a second
  // implementation here would drift from it the first time a token is added.
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!template.trim()) { setPreview(null); setBadTokens([]); return }
      try {
        const res = await fetch(
          `/api/clubs/${clubId}/channel-names?template=${encodeURIComponent(template)}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return
        const data = await res.json()
        setPreview(data.preview ?? null)
        setBadTokens(data.unknown_tokens ?? [])
      } catch { /* preview is a nicety, never a blocker */ }
    }, 250)
    return () => clearTimeout(timer)
  }, [clubId, template])

  const post = useCallback(async (body: Record<string, unknown>, method = 'POST') => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch(`/api/clubs/${clubId}/channel-names`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNotice(data.error ?? 'Something went wrong')
        return null
      }
      if (data.bindings) setState(s => ({ ...s, bindings: data.bindings }))
      return data
    } catch {
      setNotice('Could not reach the server')
      return null
    } finally {
      setBusy(false)
    }
  }, [clubId])

  const add = useCallback(async () => {
    if (!channelId || !template.trim()) return
    const data = await post({ channel_id: channelId, template })
    if (!data) return

    // Read this channel's own outcome. The club-wide tally used to stand in for
    // it, so a different channel renaming successfully in the same pass reported
    // this one as working when Discord had refused it.
    const outcome = data.outcome as { status?: string; name?: string; detail?: string } | null

    if (!data.refreshed) {
      setNotice('Saved. The bot is offline, so the name changes on its next update.')
    } else if (outcome?.status === 'updated') {
      setNotice(`Saved. The channel now reads “${outcome.name}”.`)
    } else if (outcome?.status === 'forbidden') {
      setNotice(
        'Saved, but Discord refused the rename for this channel. Open its Permissions and ' +
        'allow Manage Channels for UmaCore’s role there — a channel or category deny ' +
        'overrides the server-wide permission.'
      )
    } else if (outcome?.status === 'not_cached') {
      setNotice('Saved, but I can’t see that channel — usually a missing View Channel permission.')
    } else if (outcome?.status) {
      setNotice(`Saved, but the rename didn’t go through (${outcome.status}). It retries on the next update.`)
    } else {
      setNotice('Saved. Uma.moe has no figures for this club yet, so the name is unchanged for now.')
    }
    setChannelId('')
  }, [channelId, template, post])

  const saveEdit = useCallback(async (channelId: string) => {
    const text = editText.trim()
    if (!text) return
    const data = await post({ channel_id: channelId, template: text })
    if (!data) return
    setEditing(null)
    const outcome = data.outcome as { status?: string; name?: string } | null
    setNotice(
      outcome?.status === 'updated'
        ? `Renamed to “${outcome.name}”.`
        : outcome?.status === 'forbidden'
          ? 'Saved, but Discord refused the rename for this channel.'
          : 'Saved.'
    )
  }, [editText, post])

  const refreshNow = useCallback(async () => {
    const data = await post({ refresh_only: true })
    if (!data) return
    const r = data.refreshed
    setNotice(
      r.updated ? `Renamed ${r.updated} channel${r.updated === 1 ? '' : 's'}.`
        : r.forbidden ? 'Discord refused — allow Manage Channels for UmaCore on that channel.'
          : r.failed ? 'Nothing could be renamed. It retries on the next update.'
            : 'Everything is already up to date.'
    )
  }, [post])

  const channelById = useCallback(
    (id: string) => state.channels.find(c => c.id === id),
    [state.channels]
  )

  // Voice channels first: this exists for the locked VCs people use as headers,
  // and Discord lowercases and hyphenates text-channel names, which mangles a
  // template the moment it contains a space.
  const available = useMemo(() => {
    const bound = new Set(state.bindings.map(b => b.channel_id))
    const rank = (t: string) => (t === 'voice' ? 0 : t === 'stage' ? 1 : 2)
    return state.channels
      .filter(c => !bound.has(c.id))
      .sort((a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name))
  }, [state.channels, state.bindings])

  const picked = channelById(channelId)
  const tooLong = template.length > state.maxLength

  return (
    <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-400">Channel names</p>
        {state.bindings.length > 0 && (
          <button
            onClick={refreshNow}
            disabled={busy}
            className="text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-300 disabled:opacity-40 transition-colors"
          >
            Update now
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className="text-xs text-zinc-500 leading-relaxed">
          Let a channel&apos;s <span className="text-zinc-300">name</span> show this club&apos;s
          figures — the locked voice channel most servers keep at the top for exactly this, kept
          current without anyone editing it. The bot rewrites it after each live update
          (hourly) and again after the daily scrape. You can point several channels at the same
          club, each with its own template.
        </p>

        {state.loading ? (
          <p className="text-xs text-zinc-600">Loading…</p>
        ) : state.error ? (
          <p className="text-xs text-red-400">{state.error}</p>
        ) : (
          <>
            {/* Current bindings */}
            <div className="space-y-2">
              {state.bindings.length === 0 && (
                <p className="text-xs text-zinc-600">No channels are tracking this club yet.</p>
              )}
              {state.bindings.map(b => {
                const ch = channelById(b.channel_id)
                return (
                  <div
                    key={b.channel_id}
                    className="flex items-center gap-3 rounded border border-white/5 bg-[#111118] px-3 py-2.5"
                  >
                    <span className="text-sm shrink-0">{TYPE_ICON[ch?.type ?? 'voice'] ?? '🔊'}</span>
                    <div className="min-w-0 flex-1">
                      {editing === b.channel_id ? (
                        <input
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(b.channel_id)
                            if (e.key === 'Escape') setEditing(null)
                          }}
                          autoFocus
                          className="w-full bg-[#0d0d14] border border-violet-500/40 rounded px-2 py-1 text-sm text-white font-mono outline-none"
                        />
                      ) : (
                        <>
                          <p className="text-sm text-zinc-200 truncate">
                            {b.last_rendered ?? ch?.name ?? `Channel ${b.channel_id}`}
                            {!b.enabled && <span className="ml-2 text-[10px] text-amber-400">paused</span>}
                          </p>
                          <p className="text-[11px] text-zinc-600 font-mono truncate">{b.template}</p>
                        </>
                      )}
                      {ch && ch.can_rename === false && (
                        <p className="text-[11px] text-amber-400 mt-0.5">
                          UmaCore may be missing <span className="text-zinc-300">Manage
                          Channels</span> here. If the name stops updating, that&apos;s the
                          thing to check.
                        </p>
                      )}
                    </div>
                    {editing === b.channel_id ? (
                      <>
                        <button
                          onClick={() => saveEdit(b.channel_id)}
                          disabled={busy || !editText.trim()}
                          className="text-[11px] px-2 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 shrink-0 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 shrink-0 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditing(b.channel_id); setEditText(b.template) }}
                          disabled={busy}
                          className="text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 disabled:opacity-40 shrink-0 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => post({ channel_id: b.channel_id, enabled: !b.enabled }, 'PATCH')}
                          disabled={busy}
                          className="text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 disabled:opacity-40 shrink-0 transition-colors"
                        >
                          {b.enabled ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          onClick={() => post({ channel_id: b.channel_id }, 'DELETE')}
                          disabled={busy}
                          title="Stop tracking (the channel keeps its current name)"
                          className="w-6 h-6 rounded text-zinc-600 hover:text-white hover:bg-white/10 flex items-center justify-center disabled:opacity-40 shrink-0 transition-colors"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Add one */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              {!state.botReachable && (
                <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                  <p className="text-xs text-amber-400">Bot offline</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Can&apos;t list this server&apos;s channels right now. You can still set one in
                    Discord with <span className="font-mono text-zinc-400">/set_channel_name</span>.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <select
                  value={channelId}
                  onChange={e => setChannelId(e.target.value)}
                  disabled={busy || available.length === 0}
                  className="flex-1 min-w-0 bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors disabled:opacity-50"
                >
                  <option value="">
                    {available.length === 0 ? 'No channels available' : 'Pick a channel…'}
                  </option>
                  {available.map(c => (
                    <option key={c.id} value={c.id}>
                      {TYPE_ICON[c.type] ?? '#'} {c.name}
                      {c.category ? ` — ${c.category}` : ''}
                      {c.can_rename === false ? ' (may lack permission)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {picked && picked.can_rename === false && (
                <p className="text-[11px] text-amber-400">
                  UmaCore may not have <span className="text-zinc-300">Manage Channels</span> on
                  #{picked.name}. Save anyway — it renames straight away and tells you exactly
                  what Discord said. If that fails, open the channel&apos;s{' '}
                  <span className="text-zinc-300">Permissions</span> and allow Manage Channels
                  for UmaCore&apos;s role there: a channel or category <em>deny</em> overrides the
                  server-wide permission.
                </p>
              )}
              {picked && picked.type === 'text' && (
                <p className="text-[11px] text-amber-400">
                  Discord lowercases text-channel names and turns spaces into hyphens. A voice
                  channel keeps your template exactly as written.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-zinc-600 mr-0.5">Start from</span>
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => { setTemplate(p.template); templateRef.current?.focus() }}
                    className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                      template === p.template
                        ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                        : 'border-white/5 bg-white/5 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">
                  Name — write whatever you want. Tokens like{' '}
                  <span className="font-mono text-zinc-400">{'{rank}'}</span> fill in the
                  numbers; everything else appears exactly as typed.
                </label>
                <input
                  ref={templateRef}
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  placeholder="Rank #{rank}"
                  className="w-full bg-[#111118] border border-white/5 rounded px-3 py-2 text-sm text-white font-mono outline-none focus:border-white/20 transition-colors"
                />
                <div className="flex items-center justify-between mt-1.5 gap-3">
                  <p className="text-[11px] text-zinc-600 truncate">
                    {badTokens.length > 0 ? (
                      <span className="text-red-400">
                        Unknown: {badTokens.map(t => `{${t}}`).join(', ')}
                      </span>
                    ) : preview ? (
                      <>Looks like <span className="text-zinc-300 font-mono">{preview}</span></>
                    ) : null}
                  </p>
                  <span className={`text-[11px] shrink-0 ${tooLong ? 'text-red-400' : 'text-zinc-700'}`}>
                    {template.length}/{state.maxLength}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={add}
                  disabled={busy || !channelId || !template.trim() || badTokens.length > 0 || tooLong}
                  className="px-3 py-2 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
                >
                  {busy ? 'Saving…' : 'Track this channel'}
                </button>
                <button
                  onClick={() => setShowTokens(v => !v)}
                  className="px-3 py-2 text-xs bg-white/5 hover:bg-white/10 text-zinc-400 rounded transition-colors"
                >
                  {showTokens ? 'Hide tokens' : 'What can I put in it?'}
                </button>
              </div>

              {notice && <p className="text-[11px] text-zinc-400">{notice}</p>}

              {showTokens && (
                <div className="rounded border border-white/5 bg-[#111118] px-3 py-2.5 space-y-1">
                  {Object.entries(state.tokens).map(([token, help]) => (
                    <div key={token} className="flex gap-2 text-[11px]">
                      <button
                        onClick={() => setTemplate(t => `${t}{${token}}`)}
                        className="font-mono text-violet-300 hover:text-violet-200 shrink-0 w-32 text-left"
                        title="Add to the template"
                      >
                        {`{${token}}`}
                      </button>
                      <span className="text-zinc-500">{help}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-600 leading-relaxed border-t border-white/5 pt-3">
              Discord throttles channel renames to twice per ten minutes, so a name changes at
              most once every few minutes and only when the figures actually moved. Removing a
              channel here leaves it with whatever name it currently has.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
