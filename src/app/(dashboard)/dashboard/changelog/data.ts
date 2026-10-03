export const CHANGELOG: {
  version: string
  date: string
  isNew?: boolean
  entries: { type: 'feat' | 'fix' | 'improve'; text: string }[]
}[] = [
  {
    version: '1.8',
    date: 'Oct 3, 2026',
    isNew: true,
    entries: [
      { type: 'improve', text: 'Redesigned dashboard: larger, easier-to-read text, a club switcher at the top of the sidebar, and every club page one click away' },
      { type: 'feat',    text: 'Sidebar counts for active bombs and waiting transfer requests, so you can see what needs doing without opening each page' },
      { type: 'feat',    text: 'Press Ctrl+K to jump to any page, switch club, or search for a trainer' },
      { type: 'feat',    text: 'Charts show the exact numbers for any day you hover, and the member standings table can be sorted and filtered' },
      { type: 'feat',    text: 'My trainer shows a progress bar towards the month target, your on-track streak, and the pace you need to finish' },
      { type: 'improve', text: 'Clicking a club on the Overview opens its club home directly' },
      { type: 'improve', text: 'Quota history is shown one month at a time, the way the bot counts it, with a row of daily on-track marks per member and a month-by-month view for each trainer' },
      { type: 'improve', text: 'Club home, member standings, the Overview and the Members list now show the current month only, so numbers from earlier months no longer mix in' },
    ],
  },
  {
    version: '1.7',
    date: 'Sep 15, 2026',
    isNew: false,
    entries: [
      { type: 'feat',    text: 'My trainer — members sign in with Discord and see their own progress: surplus or deficit, fans this month, place in the club, and the daily figure they need' },
      { type: 'feat',    text: 'Month-end projection from your recent pace, shown against the target you need to finish on' },
      { type: 'feat',    text: 'Bomb status in plain terms — days left and the extra fans a day that clears it, or how many days behind you are before one starts' },
      { type: 'feat',    text: 'Turn bomb and deficit DMs on or off from the page, the same settings as /notification_settings' },
      { type: 'feat',    text: 'Your transfer requests with queue position and the decision note, once a leader decides' },
      { type: 'improve', text: 'Signing in without any clubs to manage now opens My trainer if you have linked one, instead of the invite-the-bot screen' },
    ],
  },
  {
    version: '1.6',
    date: 'Sep 8, 2026',
    isNew: false,
    entries: [
      { type: 'feat',    text: 'Transfer queue — members ask for a spot in another club with /transfer_request instead of posting their trainer ID in a channel and pinging a mod; the request stays on a waiting list until a leader decides' },
      { type: 'improve', text: 'Requests read the trainer name, ID and current club straight from /link_trainer, so there is nothing to type — and no mistyped ID for a leader to send an invite into' },
      { type: 'feat',    text: 'Transfers page — review the queue for your club, see how long each person has been waiting, and approve or decline with an optional reason that reaches the requester' },
      { type: 'feat',    text: 'Approved trainers get a DM telling them to check their in-game notifications for the new invite; declined ones get the reason, so nobody is left refreshing the club list' },
      { type: 'feat',    text: 'Leaders review in one place — /transfer_queue opens a single panel to pick and decide, rather than a pair of buttons per request cluttering a channel' },
      { type: 'improve', text: 'Queue position is order of arrival, not a rule — anyone on the list can be approved out of order' },
      { type: 'improve', text: 'Optional transfer requests channel per club (Settings, or /set_transfer_channel) announces new requests and updates each one to show how it was decided' },
      { type: 'feat',    text: '/post_transfer_info posts a pinnable guide walking members through linking, requesting and waiting for the DM, listing the clubs they can request' },
    ],
  },
  {
    version: '1.5',
    date: 'Aug 3, 2026',
    isNew: false,
    entries: [
      { type: 'fix',     text: 'Bi-weekly quota periods were saved in a format the bot did not recognise, so affected clubs were silently tracked as daily — the dashboard now writes the same value the bot reads, and rejects anything else' },
      { type: 'feat',    text: 'Live board can now be configured from Settings — set a channel for the self-editing message that tracks the competition day as it happens, or clear it to turn the board off' },
      { type: 'improve', text: 'Add club now requires a Circle ID and validates it is numeric, matching /add_club — clubs can no longer be created in a state where scraping cannot work' },
      { type: 'improve', text: 'Quota field relabelled and explained as the goal per selected period rather than per day' },
    ],
  },
  {
    version: '1.4',
    date: 'Jun 18, 2026',
    isNew: false,
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

export const LATEST_VERSION = CHANGELOG[0].version
