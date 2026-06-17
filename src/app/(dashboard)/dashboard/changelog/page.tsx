const CHANGELOG: {
  version: string
  date: string
  isNew?: boolean
  entries: { type: 'feat' | 'fix' | 'improve'; text: string }[]
}[] = [
  {
    version: '1.4',
    date: 'Jun 18, 2026',
    isNew: true,
    entries: [
      { type: 'feat',    text: 'Club editor roles — admins can assign a Discord role that lets non-admins fully manage one specific club (and create new ones), via the dashboard or /add_club_editor' },
      { type: 'feat',    text: 'Server manager roles — grant a role full management of every club in a server (create, edit, delete, assign editors), set from the Overview or /add_manager_role' },
      { type: 'improve', text: 'Club-centric dashboard — pick a club on the Overview and the sidebar plus every tab (Members, Bombs, Quota, Reports, Settings, Audit) scope to it; switch clubs from the header' },
      { type: 'improve', text: 'Overview redesigned as a clean club picker with an Add club button and per-club role assignment' },
      { type: 'improve', text: 'Add Club now only lists Discord servers the bot is actually in' },
      { type: 'improve', text: 'Audit log now records club-editor and server-manager role changes' },
    ],
  },
  {
    version: '1.3',
    date: 'May 18, 2026',
    isNew: false,
    entries: [
      { type: 'feat',    text: 'Discord verification approved — the bot can now join new servers again' },
      { type: 'feat',    text: 'Public club page — shareable /club/[slug] page showing live quota health, member status, and rank history' },
      { type: 'feat',    text: 'Image report toggle in Settings — post a visual PNG tally chart instead of the default text embeds for daily quota reports' },
      { type: 'improve', text: 'SEO — robots.txt and sitemap added so the site is properly indexed' },
    ],
  },
  {
    version: '1.2',
    date: 'Apr 30, 2026',
    isNew: false,
    entries: [
      { type: 'feat',    text: 'Guide page — bot scenario reference covering daily scrape flow, new members, bomb lifecycle, monthly resets, and quota changes' },
      { type: 'feat',    text: 'Setup checklist in Settings — live card that shows exactly what is missing before the bot can run, with per-field explanations' },
      { type: 'feat',    text: 'Onboarding empty state — new users with no clubs see a setup screen with a bot invite link and 3-step guide' },
      { type: 'improve', text: 'Add Club modal now shows a Discord server name dropdown instead of requiring you to paste a raw guild ID' },
      { type: 'improve', text: 'Club list in Settings shows an amber badge on any club with incomplete critical configuration' },
      { type: 'improve', text: 'Scrape time field now hints that 18:00 Europe/Amsterdam is recommended (when Uma.moe refreshes data)' },
    ],
  },
  {
    version: '1.1',
    date: 'Apr 28, 2026',
    isNew: false,
    entries: [
      { type: 'feat',    text: 'Club Overview page — per-club quota health, rank sparklines, and member breakdown' },
      { type: 'feat',    text: 'Member edit panel — update trainer name and status inline' },
      { type: 'feat',    text: 'Changelog page — track what\'s new across versions' },
      { type: 'feat',    text: 'Mobile responsive layout across all dashboard pages and the sidebar' },
      { type: 'improve', text: 'Login page now shows live platform stats with animated counters' },
      { type: 'improve', text: 'Login page background updated with new character video' },
      { type: 'improve', text: 'Sidebar footer with What\'s new and Ko-fi support links' },
      { type: 'fix',     text: 'Rank sparkline now filters out month-reset outliers for cleaner charts' },
    ],
  },
  {
    version: '1.0',
    date: 'Apr 27, 2026',
    entries: [
      { type: 'feat', text: 'Initial launch — quota tracking dashboard with daily and cumulative stats' },
      { type: 'feat', text: 'Member management — add, deactivate, and view per-member quota history' },
      { type: 'feat', text: 'Reports page with one-click Discord sync via bot' },
      { type: 'feat', text: 'Quota History — full per-member daily log with deficit / surplus' },
      { type: 'feat', text: 'Bomb tracker — set and monitor active bombs per member' },
      { type: 'feat', text: 'Settings — create and configure clubs, guild IDs, and scrape schedules' },
      { type: 'feat', text: 'Club rank history sparkline (30-day) on the overview dashboard' },
      { type: 'feat', text: 'Guild-based multi-tenant access control — admins only see their own clubs' },
    ],
  },
]

const badge: Record<string, string> = {
  feat:    'bg-violet-500/15 text-violet-300',
  fix:     'bg-amber-500/15  text-amber-300',
  improve: 'bg-sky-500/15    text-sky-300',
}
const label: Record<string, string> = {
  feat: 'New', fix: 'Fix', improve: 'Improved',
}

export default function ChangelogPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Changelog</h1>
        <p className="text-xs text-zinc-500 mt-0.5">What&apos;s been updated in UmaCore</p>
      </div>

      <div className="space-y-4">
        {CHANGELOG.map(release => (
          <div key={release.version} className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-3">
              <span className="text-sm font-semibold text-white">v{release.version}</span>
              {release.isNew && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 uppercase tracking-wide">
                  New
                </span>
              )}
              <span className="text-xs text-zinc-600 ml-auto">{release.date}</span>
            </div>
            <ul className="divide-y divide-white/5">
              {release.entries.map((e, i) => (
                <li key={i} className="px-5 py-3 flex items-start gap-3">
                  <span className={`mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${badge[e.type]}`}>
                    {label[e.type]}
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed">{e.text}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
