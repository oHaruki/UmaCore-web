'use client'

import type { CSSProperties, ReactNode } from 'react'

// The shape discord.py's Embed.to_dict() produces.
export type EmbedField = { name: string; value: string; inline?: boolean }
export type EmbedData = {
  title?: string
  description?: string
  color?: number
  timestamp?: string
  fields?: EmbedField[]
  footer?: { text?: string }
  thumbnail?: { url: string }
  image?: { url: string }
}

export type DiscordTheme = 'dark' | 'light'
export type MentionRole = { id: string; name: string; color: number }

// Discord's own palette, kept separate from the site's tokens: this is a
// picture of Discord, so it looks the same whatever theme the dashboard is in.
const THEMES: Record<DiscordTheme, Record<string, string>> = {
  dark: {
    '--dc-bg': '#313338', '--dc-embed': '#2b2d31', '--dc-heading': '#f2f3f5',
    '--dc-text': '#dbdee1', '--dc-muted': '#949ba4', '--dc-code': '#1e1f22',
    '--dc-spoiler': '#1e1f22', '--dc-border': '#1e1f22', '--dc-quote': '#4e5058',
    '--dc-link': '#00a8fc',
  },
  light: {
    '--dc-bg': '#ffffff', '--dc-embed': '#f2f3f5', '--dc-heading': '#060607',
    '--dc-text': '#313338', '--dc-muted': '#5c5e66', '--dc-code': '#e3e5e8',
    '--dc-spoiler': '#d4d7dc', '--dc-border': '#e3e5e8', '--dc-quote': '#c4c9ce',
    '--dc-link': '#006ce7',
  },
}

// ── markdown ───────────────────────────────────────────────────
// The subset the bot writes and people are likely to type: bold, italic,
// underline, strikethrough, code, spoilers, links, mentions, plus headings,
// subtext and quotes at the start of a line.

type Ctx = { roles: MentionRole[] }
type Rule = { re: RegExp; render: (m: RegExpExecArray, key: number, ctx: Ctx, depth: number) => ReactNode }

function Pill({ children, color }: { children: ReactNode; color?: number }) {
  const rgb = color ? `${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}` : '88, 101, 242'
  return (
    <span
      className="rounded-[3px] px-0.5 font-medium"
      style={{ background: `rgba(${rgb}, 0.2)`, color: color ? `rgb(${rgb})` : '#c9cdfb' }}
    >
      {children}
    </span>
  )
}

const inner = (m: RegExpExecArray, ctx: Ctx, depth: number) => renderInline(m[1], ctx, depth + 1)

const RULES: Rule[] = [
  { re: /`([^`]+)`/, render: (m, k) => (
    <code key={k} className="rounded-[3px] px-[0.2em] py-[0.1em] font-mono text-[0.85em] whitespace-pre-wrap" style={{ background: 'var(--dc-code)' }}>{m[1]}</code>
  ) },
  { re: /<@&(\d+)>/, render: (m, k, ctx) => {
    const role = ctx.roles.find(r => r.id === m[1])
    return <Pill key={k} color={role?.color || undefined}>@{role?.name ?? 'unknown-role'}</Pill>
  } },
  { re: /<@!?(\d+)>/, render: (_m, k) => <Pill key={k}>@member</Pill> },
  { re: /<#(\d+)>/, render: (_m, k) => <Pill key={k}>#channel</Pill> },
  { re: /@(everyone|here)\b/, render: (m, k) => <Pill key={k}>@{m[1]}</Pill> },
  { re: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/, render: (m, k, ctx, d) => (
    <span key={k} style={{ color: 'var(--dc-link)' }}>{renderInline(m[1], ctx, d + 1)}</span>
  ) },
  { re: /https?:\/\/[^\s<>]+/, render: (m, k) => <span key={k} style={{ color: 'var(--dc-link)' }}>{m[0]}</span> },
  { re: /\*\*([\s\S]+?)\*\*/, render: (m, k, ctx, d) => <strong key={k} className="font-semibold">{inner(m, ctx, d)}</strong> },
  { re: /__([\s\S]+?)__/, render: (m, k, ctx, d) => <u key={k}>{inner(m, ctx, d)}</u> },
  { re: /~~([\s\S]+?)~~/, render: (m, k, ctx, d) => <s key={k}>{inner(m, ctx, d)}</s> },
  { re: /\|\|([\s\S]+?)\|\|/, render: (m, k, ctx, d) => (
    <span key={k} className="rounded-[3px] px-0.5" style={{ background: 'var(--dc-spoiler)' }}>{inner(m, ctx, d)}</span>
  ) },
  { re: /\*([^*\n]+?)\*/, render: (m, k, ctx, d) => <em key={k}>{inner(m, ctx, d)}</em> },
  // _italic_ only at word edges, so trainer names with underscores stay as typed
  { re: /(?<![A-Za-z0-9])_([^_\n]+?)_(?![A-Za-z0-9])/, render: (m, k, ctx, d) => <em key={k}>{inner(m, ctx, d)}</em> },
]

function renderInline(text: string, ctx: Ctx, depth = 0): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let key = 0
  while (rest) {
    let best: { rule: Rule; m: RegExpExecArray } | null = null
    for (const rule of RULES) {
      const m = rule.re.exec(rest)
      if (m && (!best || m.index < best.m.index)) best = { rule, m }
    }
    if (!best || depth > 6) {
      out.push(rest)
      break
    }
    const { rule, m } = best
    if (m.index > 0) out.push(rest.slice(0, m.index))
    out.push(rule.render(m, key++, ctx, depth))
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}

const BLOCKS: { re: RegExp; render: (body: ReactNode, key: number) => ReactNode }[] = [
  { re: /^### (.*)$/, render: (b, k) => <div key={k} className="text-[16px] font-bold leading-[1.375rem]" style={{ color: 'var(--dc-heading)' }}>{b}</div> },
  { re: /^## (.*)$/, render: (b, k) => <div key={k} className="text-[20px] font-bold leading-[1.375em]" style={{ color: 'var(--dc-heading)' }}>{b}</div> },
  { re: /^# (.*)$/, render: (b, k) => <div key={k} className="text-[24px] font-bold leading-[1.375em]" style={{ color: 'var(--dc-heading)' }}>{b}</div> },
  { re: /^-# (.*)$/, render: (b, k) => <div key={k} className="text-[12px]" style={{ color: 'var(--dc-muted)' }}>{b}</div> },
  { re: /^> (.*)$/, render: (b, k) => <div key={k} className="border-l-4 pl-3" style={{ borderColor: 'var(--dc-quote)' }}>{b}</div> },
]

/** Discord-flavoured markdown. Lines keep their breaks, so render it inside whitespace-pre-wrap. */
export function renderMarkdown(text: string, roles: MentionRole[] = []): ReactNode[] {
  const ctx = { roles }
  const lines = text.split('\n')
  const out: ReactNode[] = []
  lines.forEach((line, i) => {
    const block = BLOCKS.find(b => b.re.test(line))
    if (block) {
      out.push(block.render(renderInline(line.replace(block.re, '$1'), ctx), i))
      return
    }
    out.push(<span key={i}>{renderInline(line, ctx)}</span>)
    // A block ends its own line; a plain line needs the break written out.
    if (i < lines.length - 1 && !BLOCKS.some(b => b.re.test(lines[i + 1]))) out.push('\n')
  })
  return out
}

// ── pieces ─────────────────────────────────────────────────────

function hex(color?: number) {
  return color === undefined ? '#1e1f22' : `#${color.toString(16).padStart(6, '0')}`
}

function clock(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/** Discord puts up to three inline fields side by side; anything else takes a row. */
function fieldRows(fields: EmbedField[]): EmbedField[][] {
  const rows: EmbedField[][] = []
  for (const f of fields) {
    const last = rows[rows.length - 1]
    if (f.inline && last && last.length < 3 && last.every(x => x.inline)) last.push(f)
    else rows.push([f])
  }
  return rows
}

export function Embed({ embed, roles = [] }: { embed: EmbedData; roles?: MentionRole[] }) {
  const footer = embed.footer?.text
  const md = (text: string) => renderMarkdown(text, roles)
  return (
    <div
      className="grid max-w-[520px] rounded-[4px] border-l-4 py-2 pr-4 pl-3"
      style={{ background: 'var(--dc-embed)', borderLeftColor: hex(embed.color) }}
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          {embed.title && (
            <div className="mt-1 text-[16px] font-semibold leading-[1.375rem] break-words" style={{ color: 'var(--dc-heading)' }}>
              {md(embed.title)}
            </div>
          )}
          {embed.description && (
            <div className="mt-2 text-[14px] leading-[1.375rem] whitespace-pre-wrap break-words" style={{ color: 'var(--dc-text)' }}>
              {md(embed.description)}
            </div>
          )}
          {embed.fields && embed.fields.length > 0 && (
            <div className="mt-2 grid gap-2">
              {fieldRows(embed.fields).map((row, i) => (
                <div key={i} className="grid gap-x-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                  {row.map((f, j) => (
                    <div key={j} className="min-w-0 text-[14px] leading-[1.125rem]">
                      <div className="mb-0.5 font-semibold" style={{ color: 'var(--dc-heading)' }}>{md(f.name)}</div>
                      <div className="whitespace-pre-wrap break-words" style={{ color: 'var(--dc-text)' }}>{md(f.value)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        {embed.thumbnail?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={embed.thumbnail.url} alt="" className="mt-2 size-20 shrink-0 rounded-[4px] object-contain" />
        )}
      </div>
      {embed.image?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={embed.image.url} alt="" className="mt-4 max-h-[300px] max-w-full rounded-[4px] object-contain" />
      )}
      {(footer || embed.timestamp) && (
        <div className="mt-2 text-[12px] font-medium leading-4" style={{ color: 'var(--dc-muted)' }}>
          {footer}
          {footer && embed.timestamp && <span className="mx-1">•</span>}
          {embed.timestamp && clock(embed.timestamp)}
        </div>
      )}
    </div>
  )
}

function Author() {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[15px] font-medium" style={{ color: 'var(--dc-heading)' }}>UmaCore</span>
      <span className="rounded-[3px] bg-[#5865f2] px-1 text-[10px] font-semibold leading-[15px] text-white">APP</span>
      <span className="text-[12px]" style={{ color: 'var(--dc-muted)' }}>{clock()}</span>
    </div>
  )
}

/**
 * A Discord channel showing the bot's post. ``separate`` posts each embed as
 * its own message, like the daily report; otherwise they share one, like the
 * live board. ``content`` is the text above the first one.
 */
export default function DiscordPreview({
  embeds,
  separate,
  content,
  roles = [],
  theme = 'dark',
}: {
  embeds: EmbedData[]
  separate: boolean
  content?: string | null
  roles?: MentionRole[]
  theme?: DiscordTheme
}) {
  const groups = separate ? embeds.map(e => [e]) : [embeds]
  return (
    <div
      className="rounded-xl px-4 py-3 font-[Inter,'gg_sans','Noto_Sans',sans-serif]"
      style={{ ...THEMES[theme], background: 'var(--dc-bg)', border: '1px solid var(--dc-border)' } as CSSProperties}
    >
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon" alt="" className="mt-0.5 size-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1">
          <Author />
          {groups.map((group, i) => (
            <div key={i} className="grid gap-1 pt-0.5">
              {i === 0 && content && (
                <div className="text-[15px] leading-[1.375rem] whitespace-pre-wrap break-words" style={{ color: 'var(--dc-text)' }}>
                  {renderMarkdown(content, roles)}
                </div>
              )}
              {group.map((e, j) => <Embed key={j} embed={e} roles={roles} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
