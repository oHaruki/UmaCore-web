import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllianceBySlug, loadStandings } from '@/lib/alliance'
import { listAllianceClubs } from '@/lib/recruiting'
import { CLUB_SLOTS, allianceSlots, clubPostPath } from '@/lib/recruiting-shared'
import { formatFans } from '@/lib/format'
import { Stat, StatStrip } from '@/components/dash/ui'
import { ClubRow } from '@/components/recruiting/cards'
import Leaderboard from '@/components/alliance/Leaderboard'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const a = await getAllianceBySlug(slug).catch(() => null)
  if (!a?.is_public) return { title: 'UmaCore' }
  const { rows, openSlots, openClubs } = allianceSlots(await listAllianceClubs(a.alliance_id).catch(() => []))
  const title = `${a.name} | UmaCore`
  const description = openSlots > 0
    ? `${openSlots} open slot${openSlots === 1 ? '' : 's'} across ${openClubs} of ${rows.length} clubs, from ${formatFans(rows.find(r => r.recruiting)!.perDay)} a day.`
    : `Shared leaderboard of the ${a.name} clubs in Uma Musume.`
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PublicAlliancePage({ params }: Props) {
  const { slug } = await params
  const alliance = await getAllianceBySlug(slug).catch(() => null)
  if (!alliance?.is_public) notFound()

  const [standings, clubs] = await Promise.all([
    loadStandings(alliance.alliance_id),
    listAllianceClubs(alliance.alliance_id),
  ])
  const { rows, openSlots, openClubs } = allianceSlots(clubs)
  const members = rows.reduce((n, r) => n + r.club.members, 0)

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <h1 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] md:text-[36px]">
          {alliance.name}
        </h1>
        <p className="text-sm text-fg-muted">
          {standings.clubs.map(c => c.club_name).join(', ')}
        </p>
      </header>

      {openSlots > 0 && (
        <section className="space-y-4">
          <StatStrip>
            <Stat label="Open slots" value={openSlots} hint={`across ${openClubs} club${openClubs === 1 ? '' : 's'}`} tone="good" />
            <Stat label="Members" value={<>{members}<span className="text-fg-subtle">/{rows.length * CLUB_SLOTS}</span></>} hint={`in ${rows.length} clubs`} />
            <Stat label="Quota from" value={formatFans(rows.find(r => r.recruiting)!.perDay)} hint="per day, lowest open club" />
          </StatStrip>
          <div className="space-y-3">
            {rows.map(({ club }) => (
              <ClubRow key={club.club_id} club={club} href={club.has_post ? clubPostPath(club) : undefined} />
            ))}
          </div>
          <p className="text-xs text-fg-subtle">
            Want in? Open a club&apos;s listing for its Discord, or browse <Link href="/recruiting" className="underline hover:text-fg-muted">all recruiting clubs</Link>.
          </p>
        </section>
      )}

      <Leaderboard standings={standings} linkClubs />
    </div>
  )
}
