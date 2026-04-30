import { Clock, UserPlus, Bomb, RefreshCw, LogOut, TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Guide — UmaCore' }

export default function GuidePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold text-white">Guide</h1>
        <p className="text-xs text-zinc-500 mt-0.5">How UmaCore tracks quota and manages members</p>
      </div>

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
          <Note>The bot will <strong className="text-zinc-200">not run</strong> unless a report channel is set — this is the most common setup mistake.</Note>
          <Note>Recommended scrape time: <strong className="text-zinc-200">18:00 Europe/Amsterdam</strong>. Uma.moe updates fan data around this time each day.</Note>
          <Note>If scraping fails, an error embed is posted to the report channel. Admins can retry with <code className="text-zinc-300 font-mono">/force_check</code>.</Note>
          <Note>Fan counts are <strong className="text-zinc-200">monthly totals</strong>, not lifetime. Uma.moe resets them each month and the bot tracks from 0.</Note>
        </div>
      </Card>

      {/* ── Scenarios ─────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Scenarios</p>
        <div className="space-y-4">

          {/* New member joins mid-month */}
          <Card icon={UserPlus} title="New member joins mid-month" badge="Common">
            <NewMemberVisual />
            <ul className="mt-4 space-y-2">
              <Li>The bot auto-detects the member&apos;s join date from Uma.moe — no manual setup needed.</Li>
              <Li>Quota is calculated <em>from the join date forward</em>, not from day 1 of the month.</Li>
              <Li>On their first day they&apos;ll appear as <Pill color="zinc">+0</Pill> — the pro-rata expectation equals what they have on day one.</Li>
              <Li>The bomb cannot trigger until they are behind for <strong className="text-zinc-200">3 consecutive days</strong>, so there is a natural buffer when settling in.</Li>
            </ul>
          </Card>

          {/* Bomb system */}
          <Card icon={Bomb} title="Member falls behind quota" badge="Bomb system" badgeColor="red">
            <BombLifecycle />
            <ul className="mt-4 space-y-2">
              <Li>Being behind for one or two days does <em>not</em> trigger a bomb — three <strong className="text-zinc-200">consecutive</strong> days are required.</Li>
              <Li>The countdown ticks down by one day every daily scrape, regardless of activity.</Li>
              <Li>Recovery deactivates the bomb <strong className="text-zinc-200">immediately</strong> — the moment daily surplus flips to ≥ 0, the bomb is cleared.</Li>
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
              <Li>If they reappear in a future scrape they are reactivated — their join date is reset to <strong className="text-zinc-200">today</strong>.</Li>
              <Li>This means their quota history resets as if they are brand new. Any previous deficit does not carry over.</Li>
              <Li>Members manually deactivated by an admin <em>cannot</em> auto-rejoin — an admin must reactivate them explicitly.</Li>
            </ul>
          </Card>

          {/* Quota change mid-month */}
          <Card icon={TrendingUp} title="Quota changes mid-month" badge="Retroactive" badgeColor="zinc">
            <QuotaChangeVisual />
            <ul className="mt-4 space-y-2">
              <Li>You can add a quota change at any point via <strong className="text-zinc-200">Settings → Quota changes</strong>.</Li>
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
    blue:   'bg-blue-500/10 text-blue-400',
    red:    'bg-red-500/10 text-red-400',
    violet: 'bg-violet-500/10 text-violet-400',
    amber:  'bg-amber-500/10 text-amber-400',
    zinc:   'bg-white/5 text-zinc-400',
  }
  return (
    <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2.5">
        <Icon size={14} className="text-violet-400 shrink-0" />
        <p className="text-sm font-medium text-white">{title}</p>
        {badge && (
          <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeStyles[badgeColor]}`}>
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
    <p className="text-xs text-zinc-500 bg-white/3 rounded px-3 py-2 leading-relaxed border border-white/5">
      {children}
    </p>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-xs text-zinc-400 leading-relaxed">
      <span className="mt-1 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
      <span>{children}</span>
    </li>
  )
}

function Pill({ children, color }: { children: React.ReactNode; color: 'zinc' | 'emerald' | 'red' }) {
  const c = { zinc: 'bg-white/10 text-zinc-300', emerald: 'bg-emerald-500/15 text-emerald-400', red: 'bg-red-500/15 text-red-400' }
  return <span className={`inline-block text-[11px] font-mono px-1.5 py-0.5 rounded ${c[color]}`}>{children}</span>
}

// ── Flow diagram (daily scrape) ────────────────────────────────
function FlowBox({ color, label, sub, dim }: { color: string; label: string; sub: string; dim?: boolean }) {
  const colors: Record<string, string> = {
    violet: 'border-violet-500/30 bg-violet-500/5 text-violet-300',
    blue:   'border-blue-500/30 bg-blue-500/5 text-blue-300',
    zinc:   'border-white/10 bg-white/3 text-zinc-300',
    emerald:'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
    amber:  'border-amber-500/30 bg-amber-500/5 text-amber-300',
  }
  return (
    <div className={`border rounded px-3 py-2 text-center min-w-0 ${colors[color]} ${dim ? 'opacity-50' : ''}`}>
      <p className="text-xs font-medium leading-tight">{label}</p>
      <p className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{sub}</p>
    </div>
  )
}

function FlowArrow() {
  return <span className="text-zinc-700 text-xs shrink-0">→</span>
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
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="absolute inset-y-0 bg-violet-500/25 rounded-r-full" style={{ left: `${pct(joinDay)}%` }} />
      </div>

      {/* Day labels */}
      <span className="absolute bottom-0 left-0 text-[9px] text-zinc-700">Day 1</span>
      <span className="absolute bottom-0 right-0 text-[9px] text-zinc-700">Day 31</span>

      {/* Join marker */}
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct(joinDay)}%` }}>
        <div className="w-3 h-3 rounded-full bg-violet-500 ring-2 ring-[#0d0d14] relative z-10" />
        <div className="absolute top-5 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
          <p className="text-[10px] font-semibold text-violet-400">Day {joinDay}</p>
          <p className="text-[9px] text-zinc-600">joined · quota starts</p>
        </div>
      </div>

      {/* Today marker */}
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct(todayDay)}%` }}>
        <div className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0d0d14] relative z-10" />
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
          <p className="text-[9px] text-zinc-500">today · +0</p>
        </div>
      </div>

      {/* "Not tracked" label on the left segment */}
      <div
        className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
        style={{ left: 0, width: `${pct(joinDay)}%` }}
      >
        <span className="text-[9px] text-zinc-700 mt-6">not tracked</span>
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
        <div className="flex items-center text-zinc-700 text-[10px]">→</div>
        <Stage color="amber" top="Day 2" bottom="behind" />
        <div className="flex items-center text-zinc-700 text-[10px]">→</div>
        <Stage color="red" top="Day 3" bottom="💣 bomb!" highlight />
        <div className="flex items-center text-zinc-700 text-[10px]">→</div>
        <div className="flex-1 flex flex-col justify-center bg-red-500/8 border border-red-500/20 rounded px-3 py-2">
          <p className="text-[11px] font-semibold text-red-400">Countdown</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">7 → 1 days (configurable)</p>
        </div>
      </div>

      {/* Two outcomes */}
      <div className="flex gap-2 pt-0.5">
        <div className="flex-1 bg-emerald-500/5 border border-emerald-500/20 rounded px-3 py-2.5">
          <p className="text-xs font-semibold text-emerald-400">Recovers any day</p>
          <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">Surplus flips ≥ 0 → bomb deactivated immediately, even mid-countdown</p>
        </div>
        <div className="flex-1 bg-red-500/5 border border-red-500/20 rounded px-3 py-2.5">
          <p className="text-xs font-semibold text-red-400">Countdown expires</p>
          <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">Still behind at 0 days → kick alert posted to alert channel for admin review</p>
        </div>
      </div>
    </div>
  )
}

function Stage({ color, top, bottom, highlight }: { color: string; top: string; bottom: string; highlight?: boolean }) {
  const s: Record<string, string> = {
    amber: 'border-amber-500/30 bg-amber-500/8 text-amber-300',
    red:   'border-red-500/40 bg-red-500/10 text-red-300',
  }
  return (
    <div className={`flex flex-col items-center justify-center rounded border px-3 py-2 text-center w-20 shrink-0 ${s[color]} ${highlight ? 'ring-1 ring-red-500/30' : ''}`}>
      <p className="text-[10px] font-semibold leading-tight">{top}</p>
      <p className="text-[9px] text-zinc-500 mt-0.5 leading-tight">{bottom}</p>
    </div>
  )
}

// ── Monthly reset visual ───────────────────────────────────────
function MonthlyResetVisual() {
  return (
    <div className="flex gap-3 items-stretch">
      <div className="flex-1 bg-white/3 border border-white/5 rounded px-4 py-3">
        <p className="text-[10px] font-semibold text-zinc-500 mb-2.5">End of month</p>
        <div className="space-y-1.5">
          {['Quota history', 'Active bombs', 'Quota changes'].map(l => (
            <div key={l} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-400">{l}</span>
              <span className="text-[10px] text-zinc-600 font-mono">stored</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-1 shrink-0">
        <div className="w-px flex-1 bg-white/5" />
        <div className="text-[10px] text-zinc-600 px-1 rotate-0">reset</div>
        <div className="w-px flex-1 bg-white/5" />
      </div>

      <div className="flex-1 bg-violet-500/5 border border-violet-500/20 rounded px-4 py-3">
        <p className="text-[10px] font-semibold text-violet-400 mb-2.5">New month</p>
        <div className="space-y-1.5">
          {['Quota history', 'Active bombs', 'Quota changes'].map(l => (
            <div key={l} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-500 line-through">{l}</span>
              <span className="text-[10px] text-violet-400 font-mono">cleared</span>
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
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
    amber:   'border-amber-500/30 bg-amber-500/5 text-amber-300',
    zinc:    'border-white/10 bg-white/3 text-zinc-400',
    violet:  'border-violet-500/30 bg-violet-500/5 text-violet-300',
  }
  return (
    <div className={`shrink-0 border rounded px-3 py-2 text-center ${c[color]} ${dim ? 'opacity-60' : ''}`}>
      <p className="text-[10px] font-semibold leading-tight">{label}</p>
      <p className="text-[9px] text-zinc-600 mt-0.5 leading-tight">{sub}</p>
    </div>
  )
}

function Connector({ dashed }: { dashed?: boolean }) {
  return (
    <div className={`w-6 h-px shrink-0 ${dashed ? 'border-t border-dashed border-white/15' : 'bg-white/10'}`} />
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
            className="flex-1 bg-violet-500/30 rounded-sm"
            style={{ height: `${oldHeight}%` }}
          />
        ))}
        {/* Change marker */}
        <div className="w-px bg-amber-400 self-stretch mx-1 shrink-0" />
        {Array.from({ length: newDays }).map((_, i) => (
          <div
            key={`new-${i}`}
            className="flex-1 bg-violet-500/50 rounded-sm"
            style={{ height: `${newHeight}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9px] text-zinc-600">
        <span>Days 1–{oldDays} &mdash; original rate</span>
        <span className="text-amber-500/80">↑ quota raised day {oldDays + 1}</span>
        <span>Days {oldDays + 1}–31 &mdash; new rate</span>
      </div>
    </div>
  )
}
