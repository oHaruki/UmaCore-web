import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initials, nameHue } from '@/lib/format'

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
  meta?: React.ReactNode
}) {
  return (
    <header className="space-y-3">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="font-display text-[26px] md:text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-fg text-balance">
            {title}
          </h1>
          {description && (
            <p className="max-w-[65ch] text-sm leading-relaxed text-fg-muted text-pretty">{description}</p>
          )}
          {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  /** Drop body padding, for tables and edge-to-edge lists. */
  flush?: boolean
}) {
  return (
    <section className={cn('panel overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-fg-subtle">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(!flush && 'px-5 pb-5', !flush && !(title || action) && 'pt-5', bodyClassName)}>
        {children}
      </div>
    </section>
  )
}

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'brand' | 'info'

const toneText: Record<Tone, string> = {
  neutral: 'text-fg',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  brand: 'text-brand',
  info: 'text-info',
}

export function Stat({
  label,
  value,
  tone = 'neutral',
  hint,
  size = 'md',
}: {
  label: React.ReactNode
  value: React.ReactNode
  tone?: Tone
  hint?: React.ReactNode
  size?: 'md' | 'lg'
}) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-fg-muted">{label}</p>
      <p
        className={cn(
          'num mt-1 font-display font-semibold tracking-[-0.02em] leading-none',
          size === 'lg' ? 'text-[34px]' : 'text-[24px]',
          toneText[tone]
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p>}
    </div>
  )
}

/** A row of stats sharing one panel, split by hairlines instead of separate cards. */
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'panel grid grid-cols-2 divide-line md:grid-flow-col md:auto-cols-fr md:divide-x',
        '[&>*]:px-5 [&>*]:py-4 [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line md:[&>*:nth-child(n+3)]:border-t-0',
        // An odd last tile takes the whole row on phones instead of leaving a gap.
        '[&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1',
        className
      )}
    >
      {children}
    </div>
  )
}

export function Chip({
  tone = 'neutral',
  children,
  className,
  title,
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <span title={title} className={cn('chip', `chip-${tone}`, className)}>
      {children}
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  body?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-4 grid size-11 place-items-center rounded-xl bg-surface-3 text-fg-muted">
          <Icon size={20} strokeWidth={1.75} />
        </div>
      )}
      <p className="text-[15px] font-medium text-fg">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-fg-muted text-pretty">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Shown on club-scoped pages when the user has no club yet. */
export function NoClub({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <div className="panel">
        <EmptyState
          title="No club selected"
          body="Pick a club from the switcher in the sidebar, or add one from the Overview."
          action={<Link href="/dashboard" className="btn btn-secondary">Go to Overview</Link>}
        />
      </div>
    </div>
  )
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const hue = nameHue(name)
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-[30%] font-semibold', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        background: `oklch(0.3 0.04 ${hue})`,
        color: `oklch(0.9 0.05 ${hue})`,
      }}
    >
      {initials(name)}
    </span>
  )
}

/** Horizontal split of on-track vs behind. Width is the share, not a filled track. */
export function SplitMeter({ good, bad, className }: { good: number; bad: number; className?: string }) {
  const total = good + bad
  const g = total ? (good / total) * 100 : 0
  return (
    <div className={cn('flex h-2 w-full gap-0.5 overflow-hidden rounded-full', className)}>
      {total === 0 ? (
        <div className="h-full w-full rounded-full bg-surface-3" />
      ) : (
        <>
          {good > 0 && <div className="h-full rounded-full bg-good" style={{ width: `${g}%` }} />}
          {bad > 0 && <div className="h-full flex-1 rounded-full bg-warn/80" />}
        </>
      )}
    </div>
  )
}

/** Signed value with a small bar that grows left (deficit) or right (surplus) from center. */
export function DeltaBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(1, Math.abs(value) / max) * 50 : 0
  const positive = value >= 0
  return (
    <div className="relative h-1.5 w-20 rounded-full bg-surface-3/70" aria-hidden>
      <div className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
      <div
        className={cn('absolute inset-y-0 rounded-full', positive ? 'bg-good' : 'bg-warn')}
        style={positive ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
      />
    </div>
  )
}
