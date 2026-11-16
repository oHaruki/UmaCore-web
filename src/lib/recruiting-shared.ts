// Recruiting board vocabulary, safe to import from client components.

// Mirrors CLUB_RANK_GRADES / BOTTOM_RANK_GRADE in UmaCore/config/settings.py.
const GRADE_BANDS: [number, string][] = [
  [10, 'SS'], [30, 'S+'], [100, 'S'], [500, 'A+'], [1_000, 'A'],
  [3_000, 'B+'], [5_000, 'B'], [7_000, 'C+'], [10_000, 'C'],
]
export const GRADES = [...GRADE_BANDS.map(([, g]) => g), 'D+'] as const
export type Grade = (typeof GRADES)[number]

export function gradeForRank(rank: number | null | undefined): Grade | null {
  if (!rank || rank <= 0) return null
  for (const [bound, grade] of GRADE_BANDS) if (rank <= bound) return grade as Grade
  return 'D+'
}

/** Lower is better: SS = 0. Unknown grades sort last. */
export function gradeIndex(g: string | null | undefined): number {
  const i = GRADES.indexOf(g as Grade)
  return i === -1 ? GRADES.length : i
}

export function isGrade(v: unknown): v is Grade {
  return typeof v === 'string' && (GRADES as readonly string[]).includes(v)
}

/** Badge colours, matching the bot's team card. */
export function gradeColor(g: string | null | undefined): string {
  if (!g) return '#80808c'
  if (g.startsWith('SS')) return '#ffa840'
  if (g.startsWith('S')) return '#facc15'
  if (g.startsWith('A')) return '#f472b6'
  if (g.startsWith('B')) return '#60a5fa'
  if (g.startsWith('C')) return '#34d399'
  return '#a1a1aa'
}

export const LANGUAGES = [
  'English', 'Japanese', 'Spanish', 'Portuguese', 'French', 'German', 'Italian', 'Russian', 'Polish',
  'Turkish', 'Arabic', 'Korean', 'Chinese', 'Indonesian', 'Filipino', 'Thai', 'Vietnamese',
] as const
export const MAX_LANGUAGES = 4

/** The stored "English, German" text back to a list, keeping only known names. */
export function parseLanguages(text: string | null | undefined): string[] {
  if (!text) return []
  const out: string[] = []
  for (const part of text.split(/[,/]/)) {
    const hit = LANGUAGES.find(l => l.toLowerCase() === part.trim().toLowerCase())
    if (hit && !out.includes(hit)) out.push(hit)
  }
  return out
}

export const TAGS = [
  { id: 'competitive', label: 'Competitive' },
  { id: 'casual', label: 'Casual' },
  { id: 'beginner', label: 'New players welcome' },
  { id: 'veteran', label: 'Veterans' },
  { id: 'active-chat', label: 'Active chat' },
  { id: 'voice', label: 'Voice chat' },
] as const
export const tagLabel = (id: string) => TAGS.find(t => t.id === id)?.label ?? id

export const ACCENTS = ['#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#14b8a6', '#0ea5e9', '#64748b'] as const

export const CLUB_SLOTS = 30
export const LISTED_DAYS = 30
export const BUMP_HOURS = 24

export const LIMITS = {
  headline: 80,
  clubDescription: 1500,
  playerDescription: 800,
  imageBytes: 900 * 1024, // nginx's default body cap is 1MB
} as const

/** discord.gg/abc, https://discord.com/invite/abc → canonical invite URL, else null. */
export function normalizeInvite(raw: string): string | null {
  const m = raw.trim().match(/^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,32})\/?$/)
  return m ? `https://discord.gg/${m[1]}` : null
}

/** A trainer ID as typed in game ("485 643 302 279") → digits, else null. */
export function cleanTrainerId(raw: string): string | null {
  const d = raw.replace(/\s/g, '')
  return /^\d{9,12}$/.test(d) ? d : null
}

/** "1.5M", "800k", "1,200,000" → fans. Blank is null, anything else NaN. */
export function parseFans(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[,_\s]/g, '')
  if (!s) return null
  const m = s.match(/^(\d+(?:\.\d+)?)([km]?)$/)
  if (!m) return NaN
  return Math.round(Number(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1))
}

export function formatTrainerId(id: string) {
  return id.replace(/(\d{3})(?=\d)/g, '$1 ')
}

// ── shapes the board renders ───────────────────────────────────

export type TrainerStats = {
  trainer_id: string
  trainer_name: string
  circle_id: string | null
  circle_name: string | null
  team_class: number | null
  team_rating: number | null
  followers: number | null
  monthly_fan_rank: number | null
  gain_30d: number | null
  gain_30d_rank: number | null
  daily_avg: number | null
  alltime_fans: number | null
  alltime_rank: number | null
}

export type ClubListing = {
  club_id: string
  club_name: string
  headline: string
  description: string
  discord_invite: string | null
  discord_required: boolean
  min_daily_fans: number | null
  language: string | null
  tags: string[]
  accent: string | null
  banner_image_id: string | null
  is_open: boolean
  bumped_at: string
  updated_at: string
  public_slug: string | null
  // live from the club's scrape data
  quota: number
  quota_period: string
  bombs_enabled: boolean
  members: number
  club_rank: number | null
  latest_date: string | null
  total_fans: number | null
  tracked: number
  on_track: number
}

export type PlayerListing = {
  post_id: string
  discord_user_id: string
  discord_name: string
  discord_avatar: string | null
  trainer_id: string
  trainer_name: string
  min_grade: string | null
  daily_fans: number | null
  description: string
  language: string | null
  tags: string[]
  stats: TrainerStats | null
  stats_updated_at: string | null
  is_open: boolean
  linked: boolean
  bumped_at: string
  updated_at: string
}

export function periodWord(period: string) {
  return period === 'weekly' ? 'week' : period === 'biweekly' ? '2 weeks' : 'day'
}

/** Per-day figure for a quota stored per period. */
export function quotaPerDay(quota: number, period: string) {
  return period === 'weekly' ? quota / 7 : period === 'biweekly' ? quota / 14 : quota
}

/** Average monthly fans per tracked member per day, up to the latest scrape. */
export function clubDailyAvg(c: Pick<ClubListing, 'total_fans' | 'tracked' | 'latest_date'>): number | null {
  if (!c.total_fans || !c.tracked || !c.latest_date) return null
  const day = Number(c.latest_date.slice(8, 10))
  return day > 0 ? Math.round(c.total_fans / c.tracked / day) : null
}

export function bumpReadyAt(bumpedAt: string): Date {
  return new Date(new Date(bumpedAt).getTime() + BUMP_HOURS * 3_600_000)
}

export function isListed(p: { is_open: boolean; bumped_at: string }) {
  return p.is_open && Date.now() - new Date(p.bumped_at).getTime() < LISTED_DAYS * 86_400_000
}
