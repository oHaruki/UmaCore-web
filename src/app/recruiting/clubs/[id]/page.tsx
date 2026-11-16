import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { getClubPost, UUID_RE } from '@/lib/recruiting'
import { formatDay, formatFans, timeAgo } from '@/lib/format'
import { CLUB_SLOTS, periodWord, quotaPerDay } from '@/lib/recruiting-shared'
import { Stat, StatStrip } from '@/components/dash/ui'
import { ClubBanner, GradeBadge, Monogram, Tags, clubFacts, imageUrl } from '@/components/recruiting/cards'
import CopyButton from '@/components/recruiting/CopyButton'
import { DiscordIcon } from '@/components/recruiting/DiscordIcon'

type Props = { params: Promise<{ id: string }> }

const SITE_URL = process.env.NEXTAUTH_URL ?? 'https://umacore.app'

async function load(id: string) {
  if (!UUID_RE.test(id)) return null
  return getClubPost(id).catch(() => null)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const club = await load((await params).id)
  if (!club) return { title: 'Recruiting' }
  const { grade, open } = clubFacts(club)
  const title = `${club.club_name} is recruiting`
  const description = [club.headline, grade && `${grade} club`, `${open} open slot${open === 1 ? '' : 's'}`]
    .filter(Boolean).join(', ')
  return {
    title,
    description,
    openGraph: { title, description, ...(club.banner_image_id && { images: [imageUrl(club.banner_image_id)] }) },
    twitter: { card: club.banner_image_id ? 'summary_large_image' : 'summary', title, description },
  }
}

export default async function ClubListingPage({ params }: Props) {
  const { id } = await params
  const club = await load(id)
  if (!club) notFound()

  const { grade, open, avg, onTrackPct } = clubFacts(club)
  const perDay = quotaPerDay(club.quota, club.quota_period)

  return (
    <div className="space-y-6">
      <Link href="/recruiting" className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted transition-colors hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.75} /> All clubs
      </Link>

      <section className="panel overflow-hidden">
        <ClubBanner club={club} className={club.banner_image_id ? 'h-36 md:h-52' : 'h-20 md:h-24'} />
        <div className="relative flex flex-col gap-5 px-5 pb-5 md:flex-row md:items-end md:justify-between md:px-7 md:pb-6">
          <div className="flex min-w-0 items-end gap-4">
            <div className="-mt-10"><Monogram name={club.club_name} accent={club.accent} size={76} /></div>
            <div className="min-w-0 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] md:text-[30px]">{club.club_name}</h1>
                <GradeBadge grade={grade} size="lg" />
              </div>
              <p className="mt-1 text-sm text-fg-soft text-pretty">{club.headline}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {club.discord_invite && (
              <a href={club.discord_invite} target="_blank" rel="noopener noreferrer" className="btn bg-[#5865F2] text-white hover:bg-[#4752c4]">
                <DiscordIcon /> Join their Discord
              </a>
            )}
            {club.public_slug && (
              <Link href={`/club/${club.public_slug}`} className="btn btn-secondary">
                Live standings <ExternalLink size={14} strokeWidth={1.75} />
              </Link>
            )}
            <CopyButton value={`${SITE_URL}/recruiting/clubs/${club.club_id}`} label="Copy link" className="btn btn-ghost" />
          </div>
        </div>
      </section>

      {!club.is_open && (
        <div className="panel-inset px-4 py-3 text-[13px] text-fg-muted">This club isn&apos;t taking new members right now.</div>
      )}

      <StatStrip>
        <Stat label="Club rank" value={club.club_rank ? `#${club.club_rank.toLocaleString('en-US')}` : '-'} hint={grade ? `${grade} grade this month` : 'No rank yet'} />
        <Stat
          label="Members"
          value={<>{club.members}<span className="text-fg-subtle">/{CLUB_SLOTS}</span></>}
          hint={open > 0 ? `${open} slot${open === 1 ? '' : 's'} open` : 'Full right now'}
          tone={open > 0 ? 'good' : 'warn'}
        />
        <Stat label="Avg per member" value={avg ? formatFans(avg) : '-'} hint="fans a day this month" />
        <Stat label="On track" value={onTrackPct !== null ? `${onTrackPct}%` : '-'} hint="of members meet quota" />
      </StatStrip>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="panel p-5 md:p-6 lg:self-start">
          <h2 className="text-[15px] font-semibold">About the club</h2>
          {club.description ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg-soft">{club.description}</p>
          ) : (
            <p className="mt-3 text-sm text-fg-subtle">The club hasn&apos;t written a description yet.</p>
          )}
          {club.tags.length > 0 && <div className="mt-5"><Tags tags={club.tags} /></div>}
        </section>

        <aside className="space-y-4">
          <section className="panel p-5">
            <h2 className="text-[15px] font-semibold">What they ask</h2>
            <dl className="mt-3 divide-y divide-line text-[13px]">
              <Row label="Quota">
                {formatFans(club.quota)} per {periodWord(club.quota_period)}
                {club.quota_period !== 'daily' && <span className="text-fg-subtle"> (~{formatFans(perDay)}/day)</span>}
              </Row>
              {club.min_daily_fans ? <Row label="Wants">{formatFans(club.min_daily_fans)} fans a day</Row> : null}
              <Row label="Discord">{club.discord_required ? 'Required' : 'Optional'}</Row>
              <Row label="Bombs">{club.bombs_enabled ? 'On, inactive members get removed' : 'Off'}</Row>
              {club.language && <Row label="Language">{club.language}</Row>}
            </dl>
          </section>
          <div className="space-y-1 px-1 text-xs text-fg-subtle">
            {club.latest_date && <p>Stats from the {formatDay(club.latest_date)} scrape</p>}
            <p>Listing updated {timeAgo(club.updated_at)}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right text-fg-soft">{children}</dd>
    </div>
  )
}
