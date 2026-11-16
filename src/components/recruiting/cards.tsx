import Link from 'next/link'
import { BadgeCheck, Languages } from 'lucide-react'
import { DiscordIcon } from './DiscordIcon'
import { cn } from '@/lib/utils'
import { formatFans, initials, nameHue, timeAgo } from '@/lib/format'
import {
  CLUB_SLOTS, TAGS, clubDailyAvg, gradeColor, gradeForRank, tagLabel,
  type ClubListing, type PlayerListing,
} from '@/lib/recruiting-shared'

export function GradeBadge({ grade, size = 'sm', suffix }: { grade: string | null; size?: 'sm' | 'lg'; suffix?: string }) {
  if (!grade) return null
  const c = gradeColor(grade)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-display font-semibold leading-none tracking-tight',
        size === 'lg' ? 'h-8 px-2.5 text-[17px]' : 'h-[22px] px-1.5 text-[12px]'
      )}
      style={{ color: c, background: `${c}1c`, boxShadow: `inset 0 0 0 1px ${c}40` }}
    >
      {grade}{suffix}
    </span>
  )
}

export function imageUrl(id: string) {
  return `/api/public/recruiting/images/${id}`
}

export function ClubBanner({ club, className, fade = 'bottom', label }: {
  club: Pick<ClubListing, 'banner_image_id' | 'accent'>
  className?: string
  fade?: 'bottom' | 'right'
  /** shown as big initials when the club has no artwork */
  label?: string
}) {
  const accent = club.accent ?? '#8b5cf6'
  return (
    <div className={cn('relative overflow-hidden bg-surface-2', className)}>
      {club.banner_image_id ? (
        // served from our own route; the optimizer would only re-encode it
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl(club.banner_image_id)}
          alt=""
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklab, ${accent} 30%, var(--uc-surface-2)), color-mix(in oklab, ${accent} 8%, var(--uc-surface)))`,
          }}
        >
          {label && (
            <span
              aria-hidden
              className="absolute inset-0 grid place-items-center font-display text-[40px] font-semibold tracking-[-0.03em]"
              style={{ color: `color-mix(in oklab, ${accent} 45%, white)` }}
            >
              {initials(label)}
            </span>
          )}
        </div>
      )}
      <div className={cn(
        'absolute from-surface/80 to-transparent',
        fade === 'right' ? 'inset-y-0 right-0 w-1/2 bg-gradient-to-l' : 'inset-x-0 bottom-0 h-1/2 bg-gradient-to-t'
      )} />
    </div>
  )
}

export function Monogram({ name, accent, size = 44 }: { name: string; accent?: string | null; size?: number }) {
  const hue = nameHue(name)
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[30%] font-display font-semibold ring-4 ring-surface"
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.36),
        background: accent ? `color-mix(in oklab, ${accent} 30%, #16161e)` : `oklch(0.3 0.04 ${hue})`,
        color: accent ? `color-mix(in oklab, ${accent} 35%, white)` : `oklch(0.9 0.05 ${hue})`,
      }}
    >
      {initials(name)}
    </span>
  )
}

function Meta({ language }: { language: string | null }) {
  if (!language) return null
  return (
    <span className="flex min-w-0 items-center gap-1 text-xs text-fg-soft">
      <Languages size={12} strokeWidth={1.75} className="shrink-0 text-fg-subtle" />
      <span className="truncate">{language}</span>
    </span>
  )
}

export function Tags({ tags: raw, max }: { tags: string[]; max?: number }) {
  // retired tags can still sit on older posts
  const tags = raw.filter(t => TAGS.some(x => x.id === t))
  if (!tags.length) return null
  const shown = max ? tags.slice(0, max) : tags
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map(t => <span key={t} className="chip chip-neutral">{tagLabel(t)}</span>)}
      {max && tags.length > max && <span className="chip chip-neutral">+{tags.length - max}</span>}
    </div>
  )
}

export function clubFacts(club: ClubListing) {
  const grade = gradeForRank(club.club_rank)
  const open = Math.max(0, CLUB_SLOTS - club.members)
  const avg = clubDailyAvg(club)
  const onTrackPct = club.tracked ? Math.round((club.on_track / club.tracked) * 100) : null
  return { grade, open, avg, onTrackPct }
}

const PER: Record<string, string> = { daily: 'per day', weekly: 'per week', biweekly: 'per 2 weeks' }

function RowStat({ label, value, hint, hintClass }: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  hintClass?: string
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-fg-subtle">{label}</dt>
      <dd className="num mt-1.5 truncate font-display text-[17px] font-semibold leading-none text-fg">{value}</dd>
      <dd className={cn('mt-1.5 truncate text-[11px]', hintClass ?? 'text-fg-subtle')}>{hint ?? '\u00a0'}</dd>
    </div>
  )
}

const ROW = 'panel group block @container overflow-hidden'
const ROW_LINK = 'transition-[border-color,transform] duration-200 hover:border-line-strong active:scale-[0.996] motion-reduce:transform-none'
const ROW_STATS = cn(
  'grid grid-cols-2 gap-x-5 gap-y-4 border-t border-line px-4 py-4 @md:grid-cols-4 @2xl:px-5',
  '@4xl:w-[400px] @4xl:content-center @4xl:border-l @4xl:border-t-0 @4xl:px-6'
)

function RowShell({ href, children }: { href?: string; children: React.ReactNode }) {
  return href
    ? <Link href={href} className={cn(ROW, ROW_LINK)}>{children}</Link>
    : <div className={ROW}>{children}</div>
}

/** Board row: artwork strip, who they are and what they want, then the live numbers. */
export function ClubRow({ club, href }: { club: ClubListing; href?: string }) {
  const { grade, open, avg } = clubFacts(club)
  const slots = !club.is_open
    ? { text: 'not recruiting', cls: 'text-fg-subtle' }
    : open > 0
      ? { text: `${open} open`, cls: 'text-good' }
      : { text: 'full', cls: 'text-warn' }
  return (
    <RowShell href={href}>
      <div className="grid @2xl:grid-cols-[200px_minmax(0,1fr)] @4xl:grid-cols-[232px_minmax(0,1fr)_auto]">
      <ClubBanner club={club} label={club.club_name} fade="right" className="h-24 @2xl:row-span-2 @2xl:h-full @2xl:min-h-[140px] @4xl:row-span-1" />

      <div className="min-w-0 space-y-2 p-4 @2xl:p-5">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate font-display text-[17px] font-semibold text-fg">{club.club_name}</h3>
          <GradeBadge grade={grade} />
        </div>
        <p className="line-clamp-2 text-[13.5px] leading-snug text-fg-soft text-pretty">
          {club.headline || <span className="text-fg-subtle">No headline yet</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          <Tags tags={club.tags} max={3} />
          <Meta language={club.language} />
          {club.discord_required && (
            <span className="flex items-center gap-1 text-xs text-fg-soft">
              <span className="text-[#8b93f8]"><DiscordIcon size={12} /></span> Discord required
            </span>
          )}
          {club.min_daily_fans ? (
            <span className="text-xs text-fg-subtle">wants <span className="num font-medium text-fg-soft">{formatFans(club.min_daily_fans)}</span> a day</span>
          ) : null}
        </div>
      </div>

      <dl className={ROW_STATS}>
        <RowStat label="Rank" value={club.club_rank ? `#${club.club_rank.toLocaleString('en-US')}` : '-'} hint="this month" />
        <RowStat
          label="Members"
          value={<>{club.members}<span className="text-fg-subtle">/{CLUB_SLOTS}</span></>}
          hint={slots.text}
          hintClass={slots.cls}
        />
        <RowStat label="Avg / day" value={avg ? formatFans(avg) : '-'} hint="per member" />
        <RowStat
          label="Quota"
          value={formatFans(club.quota)}
          hint={PER[club.quota_period] ?? 'per day'}
        />
      </dl>
      </div>
    </RowShell>
  )
}

/** Same anatomy as ClubRow so both tabs read alike. */
export function PlayerRow({ player, href }: { player: PlayerListing; href?: string }) {
  const s = player.stats
  return (
    <RowShell href={href}>
      <div className="grid @4xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 gap-4 p-4 @2xl:p-5">
        <PlayerAvatar player={player} size={48} />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate font-display text-[17px] font-semibold text-fg">{player.trainer_name}</h3>
              {player.linked && (
                <span title="Trainer linked to this Discord account through UmaCore" className="shrink-0 text-brand">
                  <BadgeCheck size={15} strokeWidth={2} />
                </span>
              )}
            </div>
            <p className="truncate text-xs text-fg-subtle">
              {player.discord_name}, {s?.circle_name ? <>in {s.circle_name}</> : 'not in a club'}
            </p>
          </div>
          {player.description && (
            <p className="line-clamp-2 whitespace-pre-line text-[13.5px] leading-snug text-fg-soft">{player.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <Tags tags={player.tags} max={3} />
            <Meta language={player.language} />
            <span className="text-xs text-fg-subtle">{player.is_open ? `posted ${timeAgo(player.bumped_at)}` : 'found a club'}</span>
          </div>
        </div>
      </div>

      <dl className={ROW_STATS}>
        <RowStat
          label="Wants"
          value={player.min_grade
            ? <span style={{ color: gradeColor(player.min_grade) }}>{player.min_grade}</span>
            : <span className="text-fg-soft">Any</span>}
          hint={player.min_grade ? 'or better' : 'club grade'}
        />
        <RowStat label="Can do" value={player.daily_fans ? formatFans(player.daily_fans) : '-'} hint="estimate" />
        <RowStat label="Avg / day" value={s?.daily_avg ? formatFans(s.daily_avg) : '-'} hint="last 30 days" />
        <RowStat
          label="Fan rank"
          value={s?.monthly_fan_rank ? `#${s.monthly_fan_rank.toLocaleString('en-US')}` : '-'}
          hint={s?.team_class ? `class ${s.team_class}` : undefined}
        />
      </dl>
      </div>
    </RowShell>
  )
}

export function PlayerAvatar({ player, size = 44 }: { player: Pick<PlayerListing, 'discord_avatar' | 'discord_name'>; size?: number }) {
  if (player.discord_avatar) {
    return (
      // Discord CDN avatar, not worth the image optimizer
      // eslint-disable-next-line @next/next/no-img-element
      <img src={player.discord_avatar} alt="" width={size} height={size} className="shrink-0 rounded-[30%] object-cover" style={{ width: size, height: size }} />
    )
  }
  return <Monogram name={player.discord_name} size={size} />
}
