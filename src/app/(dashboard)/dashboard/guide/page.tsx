import { Clock, UserPlus, Bomb, RefreshCw, LogOut, TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/dash/ui'

export const metadata: Metadata = { title: 'Guide — UmaCore' }

export default function GuidePage() {
  return (
    <div className="rise space-y-6 max-w-3xl">
      <PageHeader title="Guide" description="How UmaCore tracks quota and manages members." />

      {/* ── Daily scrape ─────────────────────────────────────────── */}
      <Card icon={Clock} title="How the daily scrape works">
        <div className="flex flex-wrap items-center gap-2">
          <FlowBox color="violet" label="Scrape time" sub="runs once per day" />
          <FlowArrow />
          <FlowBox color="blue" label="Uma.moe" sub="fetches fan counts" />
          <FlowArrow />
          <FlowBox color="zinc" label="Quota check" sub="per member" />
          <FlowArrow />
          <FlowBox color="emerald" label="Discord report" sub="report channel" />
          <FlowArrow />
          <FlowBox color="amber" label="Bomb check" sub="if enabled" dim />
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Note>The bot will <strong className="text-fg-soft">not run</strong> unless a report channel is set — this is the most common setup mistake.</Note>
          <Note>Recommended scrape time: <strong className="text-fg-soft">18:00 Europe/Amsterdam</strong>. Uma.moe updates fan data around this time each day.</Note>
          <Note>If scraping fails, an error embed is posted to the report channel. Admins can retry with <code className="text-fg-soft font-mono">/force_check</code>.</Note>
          <Note>Fan counts are <strong className="text-fg-soft">monthly totals</strong>, not lifetime. Uma.moe resets them each month and the bot tracks from 0.</Note>
        </div>
      </Card>

      {/* ── Scenarios ─────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-fg-subtle uppercase tracking-widest mb-3">Scenarios</p>
        <div className="space-y-4">

          {/* New member joins mid-month */}
          <Card icon={UserPlus} title="New member joins mid-month" badge="Common">
            <NewMemberVisual />
            <ul className="mt-4 space-y-2">
              <Li>The bot auto-detects the member&apos;s join date from Uma.moe — no manual setup needed.</Li>
              <Li>Quota is calculated <em>from the join date forward</em>, not from day 1 of the month.</Li>
              <Li>On their first day they&apos;ll appear as <Pill color="zinc">+0</Pill> — the pro-rata expectation equals what they have on day one.</Li>
              <Li>The bomb cannot trigger until they are behind for <strong className="text-fg-soft">3 consecutive days</strong>, so there is a natural buffer when settling in.</Li>
            </ul>
          </Card>

          {/* Bomb system */}
          <Card icon={Bomb} title="Member falls behind quota" badge="Bomb system" badgeColor="red">
            <BombLifecycle />
            <ul className="mt-4 space-y-2">
              <Li>Being behind for one or two days does <em>not</em> trigger a bomb — three <strong className="text-fg-soft">consecutive</strong> days are required.</Li>
              <Li>The countdown ticks down by one day every daily scrape, regardless of activity.</Li>
              <Li>Recovery deactivates the bomb <strong className="text-fg-soft">immediately</strong> — the moment daily surplus flips to ≥ 0, the bomb is cleared.</Li>
              <Li>When the countdown hits 0 and the member is still behind, a kick alert is posted to the alert channel. Admins kick manually — the bot never auto-kicks.</Li>
            </ul>
          </Card>

          {/* Monthly reset */}
          <Card icon={RefreshCw} title="Monthly reset" badge="Automatic" badgeColor="violet">
            <MonthlyResetVisual />
            <ul className="mt-4 space-y-2">
              <Li>Uma.moe resets all member fan counts at the start of each month — this is expected behaviour.</Li>
              <Li>The bot detects this automatically: if a member&apos;s count drops below 50% of their previous value, a reset is assumed.</Li>
              <Li>On reset: all quota history, active bombs, and mid-month quota changes are cleared. Everyone starts fresh from 0.</Li>
              <Li>The first scrape of the new month creates a new baseline for all members.</Li>
            </ul>
          </Card>

          {/* Member leaves and rejoins */}
          <Card icon={LogOut} title="Member leaves and rejoins" badge="Edge case" badgeColor="amber">
            <LeaveRejoinVisual />
            <ul className="mt-4 space-y-2">
              <Li>If a member is missing from the Uma.moe scrape they are automatically deactivated and hidden from reports.</Li>
              <Li>If they reappear in a future scrape they are reactivated — their join date is reset to <strong className="text-fg-soft">today</strong>.</Li>
              <Li>This means their quota history resets as if they are brand new. Any previous deficit does not carry over.</Li>
              <Li>Members manually deactivated by an admin <em>cannot</em> auto-rejoin — an admin must reactivate them explicitly.</Li>
            </ul>
          </Card>

          {/* Quota change mid-month */}
          <Card icon={TrendingUp} title="Quota changes mid-month" badge="Retroactive" badgeColor="zinc">
            <QuotaChangeVisual />
            <ul className="mt-4 space-y-2">
              <Li>You can add a quota change at any point via <strong className="text-fg-soft">Settings → Quota changes</strong>.</Li>
              <Li>Each day is calculated at the quota rate that was active <em>on that specific date</em> — days before the change are unaffected.</Li>
              <Li>Lowering quota mid-month can immediately bring members who were behind back to on-track status.</Li>
              <Li>Multiple quota changes in a single month are supported — each date segment uses its own rate.</Li>
            </ul>
          </Card>

        </div>
      </div>
    </div>
  )
}

// ── Shared layout ──────────────────────────────────────────────
function Card({
  icon: Icon, title, badge, badgeColor = 'blue', children,
}: {
  icon: React.ElementType
  title: string
  badge?: string
  badgeColor?: 'blue' | 'red' | 'violet' | 'amber' | 'zinc'
  children: React.ReactNode
}) {
  const badgeStyles: Record<string, string> = {
    blue:   'bg-info/10 text-info',
    red:    'bg-bad/10 text-bad',
    violet: 'bg-brand/10 text-brand',
    amber:  'bg-warn/10 text-warn',
    zinc:   'bg-surface-3 text-fg-muted',
  }
  return (
    <div className="panel overflow-hidden">
      <div className="px-5 py-3.5 border-b border-line flex items-center gap-2.5">
        <Icon size={14} className="text-brand shrink-0" />
        <p className="text-sm font-medium text-fg">{title}</p>
        {badge && (
          <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full ${badgeStyles[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-fg-muted bg-surface-2/70 rounded px-3 py-2 leading-relaxed border border-line">
      {children}
    </p>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-xs text-fg-muted leading-relaxed">
      <span className="mt-1 w-1 h-1 rounded-full bg-fg-subtle shrink-0" />
      <span>{children}</span>
    </li>
  )
}

function Pill({ children, color }: { children: React.ReactNode; color: 'zinc' | 'emerald' | 'red' }) {
  const c = { zinc: 'bg-surface-3 text-fg-soft', emerald: 'bg-good/15 text-good', red: 'bg-bad/15 text-bad' }
  return <span className={`inline-block text-xs font-mono px-1.5 py-0.5 rounded ${c[color]}`}>{children}</span>
}

// ── Flow diagram (daily scrape) ────────────────────────────────
function FlowBox({ color, label, sub, dim }: { color: string; label: string; sub: string; dim?: boolean }) {
  const colors: Record<string, string> = {
    violet: 'border-brand/30 bg-brand/5 text-brand',
    blue:   'border-info/30 bg-info/5 text-info',
    zinc:   'border-line-strong bg-surface-2/70 text-fg-soft',
    emerald:'border-good/30 bg-good/5 text-good',
    amber:  'border-warn/30 bg-warn/5 text-warn',
  }
  return (
    <div className={`border rounded px-3 py-2 text-center min-w-0 ${colors[color]} ${dim ? 'opacity-50' : ''}`}>
      <p className="text-xs font-medium leading-tight">{label}</p>
      <p className="text-[11px] text-fg-subtle mt-0.5 leading-tight">{sub}</p>
    </div>
  )
}

function FlowArrow() {
  return <span className="text-fg-subtle text-xs shrink-0">→</span>
}

// ── New member visual ──────────────────────────────────────────
function NewMemberVisual() {
  const totalDays = 31
  const joinDay   = 15
  const todayDay  = 22
  const pct = (d: number) => ((d - 1) / (totalDays - 1)) * 100

  return (
    <div className="relative select-none" style={{ height: '72px' }}>
      {/* Track */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div className="absolute inset-y-0 bg-brand/25 rounded-r-full" style={{ left: `${pct(joinDay)}%` }} />
      </div>

      {/* Day labels */}
      <span className="absolute bottom-0 left-0 text-[10px] text-fg-subtle">Day 1</span>
      <span className="absolute bottom-0 right-0 text-[10px] text-fg-subtle">Day 31</span>

      {/* Join marker */}
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct(joinDay)}%` }}>
        <div className="w-3 h-3 rounded-full bg-brand-solid ring-2 ring-surface relative z-10" />
        <div className="absolute top-5 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
          <p className="text-[11px] font-semibold text-brand">Day {joinDay}</p>
          <p className="text-[10px] text-fg-subtle">joined · quota starts</p>
        </div>
      </div>

      {/* Today marker */}
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct(todayDay)}%` }}>
        <div className="w-2 h-2 rounded-full bg-good ring-2 ring-surface relative z-10" />
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
          <p className="text-[10px] text-fg-muted">today · +0</p>
        </div>
      </div>

      {/* "Not tracked" label on the left segment */}
      <div
        className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
        style={{ left: 0, width: `${pct(joinDay)}%` }}
      >
        <span className="text-[10px] text-fg-subtle mt-6">not tracked</span>
      </div>
    </div>
  )
}

// ── Bomb lifecycle visual ──────────────────────────────────────
function BombLifecycle() {
  return (
    <div className="space-y-2">
      {/* Track */}
      <div className="flex items-stretch gap-1.5">
        <Stage color="amber" top="Day 1" bottom="behind" />
        <div className="flex items-center text-fg-subtle text-[11px]">→</div>
        <Stage color="amber" top="Day 2" bottom="behind" />
        <div className="flex items-center text-fg-subtle text-[11px]">→</div>
        <Stage color="red" top="Day 3" bottom="💣 bomb!" highlight />
        <div className="flex items-center text-fg-subtle text-[11px]">→</div>
        <div className="flex-1 flex flex-col justify-center bg-bad/8 border border-bad/20 rounded px-3 py-2">
          <p className="text-xs font-semibold text-bad">Countdown</p>
          <p className="text-[11px] text-fg-subtle mt-0.5">7 → 1 days (configurable)</p>
        </div>
      </div>

      {/* Two outcomes */}
      <div className="flex gap-2 pt-0.5">
        <div className="flex-1 bg-good/5 border border-good/20 rounded px-3 py-2.5">
          <p className="text-xs font-semibold text-good">Recovers any day</p>
          <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">Surplus flips ≥ 0 → bomb deactivated immediately, even mid-countdown</p>
        </div>
        <div className="flex-1 bg-bad/5 border border-bad/20 rounded px-3 py-2.5">
          <p className="text-xs font-semibold text-bad">Countdown expires</p>
          <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">Still behind at 0 days → kick alert posted to alert channel for admin review</p>
        </div>
      </div>
    </div>
  )
}

function Stage({ color, top, bottom, highlight }: { color: string; top: string; bottom: string; highlight?: boolean }) {
  const s: Record<string, string> = {
    amber: 'border-warn/30 bg-warn/8 text-warn',
    red:   'border-bad/40 bg-bad/10 text-bad',
  }
  return (
    <div className={`flex flex-col items-center justify-center rounded border px-3 py-2 text-center w-20 shrink-0 ${s[color]} ${highlight ? 'ring-1 ring-bad/30' : ''}`}>
      <p className="text-[11px] font-semibold leading-tight">{top}</p>
      <p className="text-[10px] text-fg-muted mt-0.5 leading-tight">{bottom}</p>
    </div>
  )
}

// ── Monthly reset visual ───────────────────────────────────────
function MonthlyResetVisual() {
  return (
    <div className="flex gap-3 items-stretch">
      <div className="flex-1 bg-surface-2/70 border border-line rounded px-4 py-3">
        <p className="text-[11px] font-semibold text-fg-muted mb-2.5">End of month</p>
        <div className="space-y-1.5">
          {['Quota history', 'Active bombs', 'Quota changes'].map(l => (
            <div key={l} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-fg-muted">{l}</span>
              <span className="text-[11px] text-fg-subtle font-mono">stored</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-1 shrink-0">
        <div className="w-px flex-1 bg-surface-3" />
        <div className="text-[11px] text-fg-subtle px-1 rotate-0">reset</div>
        <div className="w-px flex-1 bg-surface-3" />
      </div>

      <div className="flex-1 bg-brand/5 border border-brand/20 rounded px-4 py-3">
        <p className="text-[11px] font-semibold text-brand mb-2.5">New month</p>
        <div className="space-y-1.5">
          {['Quota history', 'Active bombs', 'Quota changes'].map(l => (
            <div key={l} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-fg-muted line-through">{l}</span>
              <span className="text-[11px] text-brand font-mono">cleared</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Leave & rejoin visual ──────────────────────────────────────
function LeaveRejoinVisual() {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      <TimeBlock color="emerald" label="Active" sub="tracking" />
      <Connector />
      <TimeBlock color="amber" label="Missing" sub="not in scrape" dim />
      <Connector dashed />
      <TimeBlock color="zinc" label="Deactivated" sub="hidden from reports" />
      <Connector dashed />
      <TimeBlock color="violet" label="Rejoins" sub="join date = today" />
    </div>
  )
}

function TimeBlock({ color, label, sub, dim }: { color: string; label: string; sub: string; dim?: boolean }) {
  const c: Record<string, string> = {
    emerald: 'border-good/30 bg-good/5 text-good',
    amber:   'border-warn/30 bg-warn/5 text-warn',
    zinc:    'border-line-strong bg-surface-2/70 text-fg-muted',
    violet:  'border-brand/30 bg-brand/5 text-brand',
  }
  return (
    <div className={`shrink-0 border rounded px-3 py-2 text-center ${c[color]} ${dim ? 'opacity-60' : ''}`}>
      <p className="text-[11px] font-semibold leading-tight">{label}</p>
      <p className="text-[10px] text-fg-subtle mt-0.5 leading-tight">{sub}</p>
    </div>
  )
}

function Connector({ dashed }: { dashed?: boolean }) {
  return (
    <div className={`w-6 h-px shrink-0 ${dashed ? 'border-t border-dashed border-line-strong' : 'bg-surface-3'}`} />
  )
}

// ── Quota change visual ────────────────────────────────────────
function QuotaChangeVisual() {
  const oldDays = 14
  const newDays = 17
  const oldHeight = 60
  const newHeight = 80

  return (
    <div>
      <div className="flex items-end gap-px" style={{ height: '56px' }}>
        {Array.from({ length: oldDays }).map((_, i) => (
          <div
            key={`old-${i}`}
            className="flex-1 bg-brand/30 rounded-sm"
            style={{ height: `${oldHeight}%` }}
          />
        ))}
        {/* Change marker */}
        <div className="w-px bg-warn self-stretch mx-1 shrink-0" />
        {Array.from({ length: newDays }).map((_, i) => (
          <div
            key={`new-${i}`}
            className="flex-1 bg-brand/50 rounded-sm"
            style={{ height: `${newHeight}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-fg-subtle">
        <span>Days 1–{oldDays} &mdash; original rate</span>
        <span className="text-warn/80">↑ quota raised day {oldDays + 1}</span>
        <span>Days {oldDays + 1}–31 &mdash; new rate</span>
      </div>
    </div>
  )
}
