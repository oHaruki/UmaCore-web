import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllianceBySlug, loadStandings } from '@/lib/alliance'
import Leaderboard from '@/components/alliance/Leaderboard'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const a = await getAllianceBySlug(slug).catch(() => null)
  if (!a?.is_public) return { title: 'UmaCore' }
  return {
    title: `${a.name} | UmaCore`,
    description: `Shared leaderboard of the ${a.name} clubs in Uma Musume.`,
  }
}

export default async function PublicAlliancePage({ params }: Props) {
  const { slug } = await params
  const alliance = await getAllianceBySlug(slug).catch(() => null)
  if (!alliance?.is_public) notFound()

  const standings = await loadStandings(alliance.alliance_id)

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
      <Leaderboard standings={standings} linkClubs />
    </div>
  )
}
