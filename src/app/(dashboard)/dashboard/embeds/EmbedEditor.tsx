'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { Switch } from '@/components/dash/Modal'
import DiscordPreview, { type DiscordTheme, type EmbedData, type MentionRole } from '@/components/DiscordPreview'
import { cn } from '@/lib/utils'

type Kind = 'report' | 'live'
type Mode = 'streak' | 'quota'
type BlockValue = string | number | boolean
type Block = { type: string } & Record<string, BlockValue>
type Value = BlockValue | Block[]
type Style = Record<string, Value>
type TextInput = HTMLInputElement | HTMLTextAreaElement

type FieldMeta = {
  key: string
  kind: 'template' | 'choice' | 'bool' | 'color' | 'url' | 'blocks'
  label: string
  default: BlockValue | Block[] | null
  tokens: Record<string, string> | null
  max_length: number | null
  required: boolean
  multiline: boolean
  choices: { value: string | number; label: string }[] | null
}

type KindSchema = {
  fields: FieldMeta[]
  defaults: Style
  presets: { label: string; values: Style }[]
  blocks: Record<string, { label: string; fields: FieldMeta[] }>
  block_presets: { label: string; block: Block }[]
  max_blocks: number
}

type Described = {
  kinds: Record<Kind, KindSchema>
  style: Record<Kind, Style>
  days_behind_mode: Mode
  modes: { value: Mode; label: string; help: string }[]
  quota_period: string
  bombs_enabled: boolean
  bomb_trigger_days: number | null
  roles: MentionRole[]
}

type Preview = {
  embeds: EmbedData[]
  content: string | null
  separate_messages: boolean
  notes: string[]
  errors: Record<string, string>
}

/** A style value by path: "note", or "extras.2.text" for a field of an extra block. */
function getPath(style: Style, path: string): Value | undefined {
  const [key, index, sub] = path.split('.')
  if (sub === undefined) return style[key]
  return (style[key] as Block[] | undefined)?.[Number(index)]?.[sub]
}

type SectionRow = { label: string; hint?: string; show?: string; title?: string; colors?: string[] }

// Which fields go where. Labels, options and tokens come from the bot.
const LAYOUT: Record<Kind, { lines: string[]; numbers: string[]; sections: SectionRow[] }> = {
  report: {
    lines: ['line_on_track', 'line_behind', 'line_bomb'],
    numbers: ['decimals', 'sort_on_track', 'sort_behind'],
    sections: [
      { label: 'Header', hint: 'Date, quota and period', title: 'title', colors: ['color_report'] },
      { label: 'Summary counts', hint: 'Total, on track, behind', show: 'show_summary' },
      { label: 'Club rankings', hint: 'Rank and next milestone', show: 'show_rankings' },
      { label: 'On track', show: 'show_on_track', title: 'title_on_track', colors: ['color_on_track'] },
      { label: 'Behind', show: 'show_behind', title: 'title_behind', colors: ['color_behind'] },
      { label: 'Bombs', show: 'show_bombs', title: 'title_bombs', colors: ['color_bombs'] },
    ],
  },
  live: {
    lines: ['line_raced', 'line_idle', 'line_joined'],
    numbers: ['decimals', 'sort_raced', 'sort_idle'],
    sections: [
      { label: 'Header', hint: 'Colour while live, then once closed', title: 'title', colors: ['color_open', 'color_closed'] },
      { label: 'Summary counts', hint: 'Total, raced, not yet', show: 'show_summary' },
      { label: 'Rank', show: 'show_rank' },
      { label: 'Month total', show: 'show_month_total' },
      { label: 'Raced today', title: 'title_raced', colors: ['color_raced'] },
      { label: 'No fans yet', show: 'show_idle', title: 'title_idle', colors: ['color_idle'] },
      { label: 'Joined today', show: 'show_joined', title: 'title_joined', colors: ['color_joined'] },
    ],
  },
}

const KIND_LABEL: Record<Kind, string> = { report: 'Daily report', live: 'Live board' }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export default function EmbedEditor({ clubId }: { clubId: string }) {
  const [info, setInfo] = useState<Described | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [styles, setStyles] = useState<Record<Kind, Style> | null>(null)
  const [mode, setMode] = useState<Mode>('streak')
  const [saved, setSaved] = useState<{ styles: Record<Kind, Style>; mode: Mode } | null>(null)

  const [kind, setKind] = useState<Kind>('report')
  const [closed, setClosed] = useState(false)
  const [theme, setTheme] = useState<DiscordTheme>('dark')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [saveErrors, setSaveErrors] = useState<Partial<Record<Kind, Record<string, string>>>>({})

  // The template last typed in, so token buttons know where to insert.
  const [focused, setFocused] = useState<string | null>(null)
  const inputs = useRef<Record<string, TextInput | null>>({})

  // Bumped by "Try again" to load once more.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    fetch(`/api/clubs/${clubId}/embeds`, { cache: 'no-store' })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Could not load the editor')
        if (!current) return
        setInfo(data)
        setStyles(data.style)
        setMode(data.days_behind_mode)
        setSaved({ styles: data.style, mode: data.days_behind_mode })
      })
      .catch(e => {
        if (current) setLoadError(e instanceof Error ? e.message : 'Could not load the editor')
      })
    return () => { current = false }
  }, [clubId, attempt])

  // Rendered by the bot from the club's own figures, so what shows here is what
  // the channel gets. Debounced, since it re-renders on every pause in typing.
  const style = styles?.[kind]
  useEffect(() => {
    if (!style) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setPreviewing(true)
      try {
        const res = await fetch(`/api/clubs/${clubId}/embeds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, style, days_behind_mode: mode, closed }),
          signal: ctrl.signal,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Preview unavailable')
        setPreview(data)
        setPreviewError(null)
      } catch (e) {
        if (ctrl.signal.aborted) return
        setPreviewError(e instanceof Error ? e.message : 'Preview unavailable')
      } finally {
        if (!ctrl.signal.aborted) setPreviewing(false)
      }
    }, 300)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [clubId, kind, style, mode, closed])

  const schema = info?.kinds[kind]
  const fieldMap = useMemo(
    () => Object.fromEntries((schema?.fields ?? []).map(f => [f.key, f])) as Record<string, FieldMeta>,
    [schema]
  )

  const dirty = !!saved && !!styles && (!same(styles, saved.styles) || mode !== saved.mode)
  const errors: Record<string, string> = { ...(preview?.errors ?? {}), ...(saveErrors[kind] ?? {}) }
  const hasErrors = Object.keys(errors).length > 0

  const set = useCallback((path: string, value: Value) => {
    setStyles(s => {
      if (!s) return s
      const current = s[kind]
      const [key, index, sub] = path.split('.')
      if (sub === undefined) return { ...s, [kind]: { ...current, [key]: value } }
      const blocks = [...((current[key] as Block[] | undefined) ?? [])]
      blocks[Number(index)] = { ...blocks[Number(index)], [sub]: value as BlockValue }
      return { ...s, [kind]: { ...current, [key]: blocks } }
    })
    setSaveErrors(e => {
      // Adding, moving or removing a block shifts every extras.N after it.
      const stale = (k: string) => k === path || (path === 'extras' && k.startsWith('extras'))
      if (!Object.keys(e[kind] ?? {}).some(stale)) return e
      return { ...e, [kind]: Object.fromEntries(Object.entries(e[kind] ?? {}).filter(([k]) => !stale(k))) }
    })
    setSaveState('idle')
  }, [kind])

  const blocks = (style?.extras as Block[] | undefined) ?? []
  const setBlocks = (next: Block[]) => { setFocused(null); set('extras', next) }

  const fieldFor = useCallback((path: string): FieldMeta | undefined => {
    const [key, index, sub] = path.split('.')
    if (sub === undefined) return fieldMap[key]
    const block = (style?.extras as Block[] | undefined)?.[Number(index)]
    return block ? schema?.blocks[block.type]?.fields.find(f => f.key === sub) : undefined
  }, [fieldMap, style, schema])

  // Puts text at the cursor of the given field, or at its end if it isn't focused.
  const insertText = useCallback((path: string, piece: string) => {
    if (!style) return
    const el = inputs.current[path]
    const text = String(getPath(style, path) ?? '')
    const focusedHere = el && document.activeElement === el
    const at = focusedHere ? el.selectionStart ?? text.length : text.length
    const end = focusedHere ? el.selectionEnd ?? at : at
    set(path, text.slice(0, at) + piece + text.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + piece.length, at + piece.length)
    })
  }, [style, set])

  const insertToken = useCallback((token: string) => {
    if (focused && fieldFor(focused)?.tokens?.[token] !== undefined) insertText(focused, `{${token}}`)
  }, [focused, fieldFor, insertText])

  const save = async () => {
    if (!styles) return
    setSaveState('saving')
    setSaveNote(null)
    try {
      const res = await fetch(`/api/clubs/${clubId}/embeds`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: styles, days_behind_mode: mode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.errors) {
          setSaveErrors(data.errors)
          const broken = (Object.keys(data.errors) as Kind[]).find(k => Object.keys(data.errors[k] ?? {}).length)
          if (broken) setKind(broken)
        }
        setSaveNote(data.error ?? 'Not saved')
        setSaveState('error')
        return
      }
      setSaved({ styles, mode })
      setSaveErrors({})
      setSaveState('saved')
      setSaveNote('Saved. The next report and live board update use it.')
    } catch {
      setSaveState('error')
      setSaveNote('Could not reach the server')
    }
  }

  if (loadError) {
    return (
      <div className="panel px-5 py-10 text-center">
        <p className="text-sm text-fg-soft">{loadError}</p>
        <button onClick={() => { setLoadError(null); setAttempt(a => a + 1) }} className="btn btn-secondary btn-sm mt-4">Try again</button>
      </div>
    )
  }

  if (!info || !styles || !style || !schema) {
    return <div className="panel px-5 py-10 text-center text-sm text-fg-subtle">Loading…</div>
  }

  const layout = LAYOUT[kind]
  const tokenField = (focused && fieldFor(focused)) || fieldMap[layout.lines[0]]
  // Shown in whichever card holds the field being typed in.
  const tokensIn = !focused || layout.lines.includes(focused) ? 'lines'
    : focused === 'footer' || focused.startsWith('title') ? 'sections' : 'extras'
  const tokenPanel = tokenField?.tokens ? (
    <div className="mt-4 rounded-[10px] border border-line bg-surface-2 px-3 py-2.5">
      <p className="mb-1.5 text-xs text-fg-muted">
        Tokens for <span className="text-fg-soft">{tokenField.label.toLowerCase()}</span>
        {focused ? ' (click to insert at the cursor)' : ' (click a field first, then a token)'}
      </p>
      <div className="grid gap-y-1">
        {Object.entries(tokenField.tokens).map(([token, help]) => (
          <div key={token} className="flex min-w-0 gap-3 text-xs">
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => insertToken(token)}
              disabled={!focused}
              className="w-32 shrink-0 text-left font-mono text-brand hover:text-brand-strong disabled:text-fg-muted"
              title="Insert"
            >
              {`{${token}}`}
            </button>
            <span className="min-w-0 text-fg-subtle">{help}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle">
        Add a width to line things up inside a code span: <span className="font-mono text-fg-muted">`{'{pos:>2}'}`</span> pads to two characters.
        Use <span className="font-mono text-fg-muted">**bold**</span>, <span className="font-mono text-fg-muted">*italic*</span> and <span className="font-mono text-fg-muted">`code`</span> as in Discord.
      </p>
    </div>
  ) : null
  const activePreset = schema.presets.find(p => Object.entries(p.values).every(([k, v]) => style[k] === v))
  const triggerDays = info.bomb_trigger_days ?? 3

  return (
    <div className="space-y-4">
      {/* Which embed */}
      <div className="flex items-center gap-1 border-b border-line" role="tablist" aria-label="Embed">
        {(Object.keys(KIND_LABEL) as Kind[]).map(k => {
          const broken = Object.keys(saveErrors[k] ?? {}).length > 0
          return (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => { setKind(k); setFocused(null) }}
              className={cn(
                'relative -mb-px flex h-10 items-center gap-2 px-3 text-[13px] font-medium transition-colors',
                kind === k ? 'text-fg' : 'text-fg-muted hover:text-fg'
              )}
            >
              {KIND_LABEL[k]}
              {broken && <span className="size-1.5 rounded-full bg-bad" aria-label="has errors" />}
              {kind === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-solid" />}
            </button>
          )
        })}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
        {/* ── Editor ── */}
        <div className="min-w-0 space-y-4">
          {kind === 'report' && (
            <Card
              title="Days behind"
              description="How the report, the DMs and the bomb trigger count it. All three always agree."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {info.modes.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => { setMode(m.value); setSaveState('idle') }}
                    aria-pressed={mode === m.value}
                    className={cn(
                      'rounded-[10px] border px-3.5 py-3 text-left transition-colors',
                      mode === m.value ? 'border-brand/50 bg-brand/8' : 'border-line bg-surface-2 hover:border-line-strong'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn('size-3.5 rounded-full border-2', mode === m.value ? 'border-brand bg-brand' : 'border-fg-subtle')} />
                      <span className="text-[13px] font-medium text-fg">{m.label}</span>
                    </span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-fg-muted">{m.help}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
                {info.bombs_enabled
                  ? <>Bombs follow this count: one starts once someone is <span className="text-fg-soft">{triggerDays} {mode === 'quota' ? `days of quota behind` : `days in a row behind`}</span>, and it&apos;s defused once they reach the full quota again.</>
                  : <>Bombs are off for this club, so this changes the report and the deficit DMs.</>}
                {mode !== saved?.mode && ' Takes effect from the next daily check.'}
              </p>
            </Card>
          )}

          <Card title="Member lines" description="One line per member. Tokens in braces fill in the numbers; everything else appears as typed, Discord formatting included.">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-xs text-fg-subtle">Start from</span>
              {schema.presets.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => Object.entries(p.values).forEach(([k, v]) => set(k, v))}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs transition-colors',
                    activePreset === p ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line bg-surface-3 text-fg-muted hover:text-fg-soft'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {layout.lines.map(key => (
                <TemplateField
                  key={key}
                  field={fieldMap[key]}
                  value={String(style[key] ?? '')}
                  error={errors[key]}
                  onChange={v => set(key, v)}
                  onFocus={() => setFocused(key)}
                  inputRef={el => { inputs.current[key] = el }}
                  hint={key === 'line_bomb' && !info.bombs_enabled ? 'Bombs are off, so this line is not shown.' : undefined}
                />
              ))}
            </div>

            {tokensIn === 'lines' && tokenPanel}
          </Card>

          <Card title="Numbers and order">
            <div className="grid gap-4 sm:grid-cols-3">
              {layout.numbers.map(key => {
                const f = fieldMap[key]
                return (
                  <label key={key} className="block min-w-0">
                    <span className="mb-1.5 block text-[13px] font-medium text-fg-soft">{f.label}</span>
                    <select
                      value={String(style[key])}
                      onChange={e => {
                        const choice = f.choices?.find(c => String(c.value) === e.target.value)
                        if (choice) set(key, choice.value)
                      }}
                      className="field"
                    >
                      {f.choices?.map(c => <option key={String(c.value)} value={String(c.value)}>{c.label}</option>)}
                    </select>
                    {errors[key] && <span className="mt-1 block text-[11px] text-bad">{errors[key]}</span>}
                  </label>
                )
              })}
            </div>
          </Card>

          <Card title="Sections" description="Turn parts of the embed on or off, rename them, and pick their colours.">
            <div className="divide-y divide-line">
              {layout.sections.map(row => (
                <SectionRowEditor
                  key={row.label}
                  row={row}
                  style={style}
                  fieldMap={fieldMap}
                  errors={errors}
                  set={set}
                  onTitleFocus={key => setFocused(key)}
                  inputRef={(key, el) => { inputs.current[key] = el }}
                />
              ))}
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <TemplateField
                field={fieldMap.footer}
                value={String(style.footer ?? '')}
                error={errors.footer}
                onChange={v => set('footer', v)}
                onFocus={() => setFocused('footer')}
                inputRef={el => { inputs.current.footer = el }}
                hint="Leave empty for no footer."
              />
            </div>
            {tokensIn === 'sections' && tokenPanel}
          </Card>

          <Card
            title="Extras"
            description="Your own text, images, fields and member lists on top of the built-in sections. Click into any box to see the tokens it takes."
          >
            <div className="space-y-4">
              <div>
                <TemplateField
                  field={fieldMap.message}
                  value={String(style.message ?? '')}
                  error={errors.message}
                  onChange={v => set('message', v)}
                  onFocus={() => setFocused('message')}
                  inputRef={el => { inputs.current.message = el }}
                  hint={kind === 'report'
                    ? 'Plain text posted with the report, so a role here is pinged once a day. @everyone and @here never ping.'
                    : 'Pings once when each day’s board is posted; the edits through the day stay quiet. @everyone and @here never ping.'}
                />
                {info.roles.length > 0 && (
                  <select
                    value=""
                    onChange={e => { if (e.target.value) insertText('message', `<@&${e.target.value}> `) }}
                    aria-label="Ping a role"
                    className="field mt-2 h-8 text-xs sm:w-60"
                  >
                    <option value="">Ping a role…</option>
                    {info.roles.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}
                  </select>
                )}
              </div>

              <TemplateField
                field={fieldMap.note}
                value={String(style.note ?? '')}
                error={errors.note}
                onChange={v => set('note', v)}
                onFocus={() => setFocused('note')}
                inputRef={el => { inputs.current.note = el }}
                hint="Shown in the header, under the date and quota."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                {(['thumbnail', 'image'] as const).map(key => (
                  <TemplateField
                    key={key}
                    field={fieldMap[key]}
                    value={String(style[key] ?? '')}
                    error={errors[key]}
                    onChange={v => set(key, v)}
                    onFocus={() => setFocused(null)}
                    inputRef={el => { inputs.current[key] = el }}
                    placeholder="https://…"
                    hint={key === 'thumbnail' ? 'Small image in the top corner, like a club logo.' : 'Large image at the bottom of the header.'}
                  />
                ))}
              </div>

              <div className="border-t border-line pt-4">
                <p className="text-[13px] font-medium text-fg-soft">Extra fields and lists</p>
                <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">
                  Fields sit in the header next to the summary. Lists come after the built-in sections, in this order,
                  and only show when someone matches.
                </p>
                {errors.extras && <p className="mt-1 text-[11px] text-bad">{errors.extras}</p>}

                <div className="mt-3 space-y-3">
                  {blocks.map((block, i) => (
                    <BlockEditor
                      key={i}
                      index={i}
                      count={blocks.length}
                      block={block}
                      spec={schema.blocks[block.type]}
                      errors={errors}
                      set={set}
                      onFocus={path => setFocused(path)}
                      inputRef={(path, el) => { inputs.current[path] = el }}
                      onMove={dir => {
                        const next = [...blocks]
                        const [moved] = next.splice(i, 1)
                        next.splice(i + dir, 0, moved)
                        setBlocks(next)
                      }}
                      onRemove={() => setBlocks(blocks.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>

                {blocks.length < schema.max_blocks ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="mr-0.5 text-xs text-fg-subtle">Add</span>
                    {schema.block_presets.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setBlocks([...blocks, { ...p.block }])}
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-3 px-2 py-1 text-xs text-fg-muted transition-colors hover:text-fg-soft"
                      >
                        <Plus size={12} strokeWidth={2} />
                        {p.label}
                      </button>
                    ))}
                    {Object.entries(schema.blocks).map(([type, spec]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBlocks([...blocks, blankBlock(type, spec.fields)])}
                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-line-strong px-2 py-1 text-xs text-fg-muted transition-colors hover:text-fg-soft"
                      >
                        <Plus size={12} strokeWidth={2} />
                        Empty {spec.label.toLowerCase()}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-fg-subtle">That’s the most an embed can hold ({schema.max_blocks}).</p>
                )}
              </div>
            </div>
            {tokensIn === 'extras' && tokenPanel}
          </Card>
        </div>

        {/* ── Preview ── */}
        <div id="embed-preview" className="min-w-0 scroll-mt-4 space-y-3 lg:sticky lg:top-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-fg">
              Preview
              {previewing && <span className="ml-2 text-xs font-normal text-fg-subtle">updating…</span>}
            </h2>
            <div className="flex items-center gap-1.5">
              {kind === 'live' && (
                <Segmented
                  value={closed ? 'closed' : 'live'}
                  options={[{ value: 'live', label: 'Live' }, { value: 'closed', label: 'Closed' }]}
                  onChange={v => setClosed(v === 'closed')}
                />
              )}
              <Segmented
                value={theme}
                options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
                onChange={v => setTheme(v as DiscordTheme)}
              />
            </div>
          </div>

          {previewError && !preview ? (
            <div className="panel px-5 py-10 text-center text-sm text-fg-muted">{previewError}</div>
          ) : preview ? (
            <div className={cn('rounded-xl transition-opacity lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto', previewing && 'opacity-70')}>
              <DiscordPreview
                embeds={preview.embeds}
                separate={preview.separate_messages}
                content={preview.content}
                roles={info.roles}
                theme={theme}
              />
            </div>
          ) : (
            <div className="panel px-5 py-10 text-center text-sm text-fg-subtle">Rendering…</div>
          )}

          {previewError && preview && <p className="text-xs text-warn">{previewError}. Showing the last preview.</p>}
          {preview?.notes.map(n => <p key={n} className="text-xs leading-relaxed text-fg-subtle">{n}</p>)}
        </div>
      </div>

      {/* ── Save bar ── */}
      <div className="sticky bottom-4 z-10">
        <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className={cn('text-xs', saveState === 'error' ? 'text-bad' : saveState === 'saved' ? 'text-good' : 'text-fg-muted')}>
            {saveNote ?? (hasErrors ? 'Fix the fields marked in red to save' : dirty ? 'Unsaved changes' : 'Everything is saved')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a href="#embed-preview" className="btn btn-secondary btn-sm lg:hidden">Preview</a>
            <button
              type="button"
              onClick={() => { setStyles(s => (s ? { ...s, [kind]: { ...schema.defaults } } : s)); setSaveState('idle'); setSaveNote(null) }}
              disabled={same(style, schema.defaults)}
              className="btn btn-ghost btn-sm"
            >
              Reset {KIND_LABEL[kind].toLowerCase()} to default
            </button>
            {dirty && saved && (
              <button
                type="button"
                onClick={() => { setStyles(saved.styles); setMode(saved.mode); setSaveErrors({}); setSaveState('idle'); setSaveNote(null) }}
                className="btn btn-secondary btn-sm"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saveState === 'saving' || hasErrors}
              className="btn btn-primary btn-sm"
            >
              {saveState === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── pieces ─────────────────────────────────────────────────────

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="panel overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-fg-subtle">{description}</p>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}

function TemplateField({ field, value, error, hint, placeholder, idSuffix, onChange, onFocus, inputRef }: {
  field: FieldMeta
  value: string
  error?: string
  hint?: string
  placeholder?: string
  idSuffix?: string
  onChange: (v: string) => void
  onFocus: () => void
  inputRef: (el: TextInput | null) => void
}) {
  const max = field.max_length ?? 0
  const id = `tpl-${idSuffix ?? field.key}`
  const props = {
    id,
    value,
    placeholder,
    spellCheck: false,
    onFocus,
    className: cn('field font-mono text-xs', error && 'border-bad/60 focus:border-bad/70'),
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-fg-soft">{field.label}</label>
      {field.multiline ? (
        <textarea {...props} ref={inputRef} rows={3} onChange={e => onChange(e.target.value)} className={cn(props.className, 'resize-y leading-relaxed')} />
      ) : (
        <input {...props} ref={inputRef} onChange={e => onChange(e.target.value)} />
      )}
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className={cn('min-w-0 text-[11px]', error ? 'text-bad' : 'text-fg-subtle')}>{error ?? hint}</p>
        {max > 0 && (
          <span className={cn('num shrink-0 text-[11px]', value.length > max ? 'text-bad' : 'text-fg-subtle')}>
            {value.length}/{max}
          </span>
        )}
      </div>
    </div>
  )
}

function blankBlock(type: string, fields: FieldMeta[]): Block {
  return { type, ...Object.fromEntries(fields.map(f => [f.key, (f.default ?? '') as BlockValue])) }
}

/** One extra field or member list, edited from the bot's description of its fields. */
function BlockEditor({ index, count, block, spec, errors, set, onFocus, inputRef, onMove, onRemove }: {
  index: number
  count: number
  block: Block
  spec?: { label: string; fields: FieldMeta[] }
  errors: Record<string, string>
  set: (path: string, value: Value) => void
  onFocus: (path: string) => void
  inputRef: (path: string, el: TextInput | null) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  if (!spec) return null
  const path = (key: string) => `extras.${index}.${key}`
  const templates = spec.fields.filter(f => f.kind === 'template')
  const choices = spec.fields.filter(f => f.kind === 'choice')
  const toggles = spec.fields.filter(f => f.kind === 'bool' || f.kind === 'color')
  const template = (f: FieldMeta) => (
    <TemplateField
      key={f.key}
      field={f}
      idSuffix={`extras-${index}-${f.key}`}
      value={String(block[f.key] ?? '')}
      error={errors[path(f.key)]}
      onChange={v => set(path(f.key), v)}
      onFocus={() => onFocus(path(f.key))}
      inputRef={el => inputRef(path(f.key), el)}
    />
  )

  return (
    <div className="rounded-[10px] border border-line bg-surface-2 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="chip chip-neutral">{spec.label}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{String(block.title || '')}</span>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="btn btn-ghost btn-xs px-1.5" aria-label="Move up">
          <ChevronUp size={14} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} className="btn btn-ghost btn-xs px-1.5" aria-label="Move down">
          <ChevronDown size={14} />
        </button>
        <button type="button" onClick={onRemove} className="btn btn-danger-ghost btn-xs px-1.5" aria-label="Remove">
          <X size={14} />
        </button>
      </div>
      {errors[`extras.${index}`] && <p className="mb-2 text-[11px] text-bad">{errors[`extras.${index}`]}</p>}

      <div className="space-y-3">
        {templates.slice(0, 1).map(template)}
        {choices.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {choices.map(f => (
              <label key={f.key} className="block min-w-0">
                <span className="mb-1.5 block text-[13px] font-medium text-fg-soft">{f.label}</span>
                <select
                  value={String(block[f.key])}
                  onChange={e => {
                    const choice = f.choices?.find(c => String(c.value) === e.target.value)
                    if (choice) set(path(f.key), choice.value)
                  }}
                  className="field"
                >
                  {f.choices?.map(c => <option key={String(c.value)} value={String(c.value)}>{c.label}</option>)}
                </select>
                {errors[path(f.key)] && <span className="mt-1 block text-[11px] text-bad">{errors[path(f.key)]}</span>}
              </label>
            ))}
          </div>
        )}
        {templates.slice(1).map(template)}
        {toggles.length > 0 && (
          <div className="flex flex-wrap items-center gap-4">
            {toggles.map(f => f.kind === 'bool' ? (
              <label key={f.key} className="flex items-center gap-2 text-[13px] text-fg-soft">
                <Switch checked={!!block[f.key]} onChange={v => set(path(f.key), v)} label={f.label} />
                {f.label}
              </label>
            ) : (
              <span key={f.key} className="flex items-center gap-2 text-[13px] text-fg-soft">
                <ColorInput label={f.label} value={String(block[f.key])} onChange={v => set(path(f.key), v)} />
                {f.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionRowEditor({ row, style, fieldMap, errors, set, onTitleFocus, inputRef }: {
  row: SectionRow
  style: Style
  fieldMap: Record<string, FieldMeta>
  errors: Record<string, string>
  set: (key: string, value: Value) => void
  onTitleFocus: (key: string) => void
  inputRef: (key: string, el: TextInput | null) => void
}) {
  const on = row.show ? style[row.show] !== false : true
  const titleError = row.title ? errors[row.title] : undefined
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 items-center gap-3 sm:w-44 sm:shrink-0">
        {row.show ? (
          <Switch checked={on} onChange={v => set(row.show!, v)} label={`Show ${row.label.toLowerCase()}`} />
        ) : (
          <span className="w-11 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-fg-soft">{row.label}</p>
          {row.hint && <p className="truncate text-[11px] text-fg-subtle">{row.hint}</p>}
        </div>
      </div>
      {(row.title || row.colors) && (
        <div className={cn('flex min-w-0 flex-1 items-center gap-2 transition-opacity', !on && 'pointer-events-none opacity-40')}>
          {row.title && (
            <div className="min-w-0 flex-1">
              <input
                ref={el => inputRef(row.title!, el)}
                value={String(style[row.title] ?? '')}
                onChange={e => set(row.title!, e.target.value)}
                onFocus={() => onTitleFocus(row.title!)}
                placeholder="No title"
                aria-label={fieldMap[row.title]?.label}
                spellCheck={false}
                className={cn('field h-8 text-xs', titleError && 'border-bad/60')}
              />
              {titleError && <p className="mt-1 text-[11px] text-bad">{titleError}</p>}
            </div>
          )}
          {row.colors?.map(key => (
            <ColorInput key={key} label={fieldMap[key]?.label ?? key} value={String(style[key])} onChange={v => set(key, v)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label
      title={`${label}: ${value}`}
      className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line-strong"
      style={{ background: value }}
    >
      <span className="sr-only">{label}</span>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  )
}

function Segmented({ value, options, onChange }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-6 rounded-md px-2 text-[11px] font-medium transition-colors',
            value === o.value ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
