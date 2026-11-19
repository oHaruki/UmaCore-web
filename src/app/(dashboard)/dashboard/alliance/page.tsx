import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import { ownsClub } from '@/lib/guild-check'
import { effectiveOwnerId, getAllianceForClub, loadStandings } from '@/lib/alliance'
import { Chip, NoClub, PageHeader } from '@/components/dash/ui'
import Leaderboard from '@/components/alliance/Leaderboard'
import { AllianceManager, AllianceSetup } from './AllianceControls'

export const metadata = { title: 'Alliance' }

export default async function AlliancePage() {
  const session = (await auth())!
  const { active } = await resolveActiveClub(session)
  if (!active) return <NoClub title="Alliance" />

  const alliance = await getAllianceForClub(active.club_id).catch(() => null)

  if (!alliance) {
    return (
      <div className="rise space-y-6">
        <PageHeader
          title="Alliance"
          description={`Put ${active.club_name} and its sister clubs on one shared leaderboard. One club starts the alliance and shares its code, the others join with it.`}
        />
        <AllianceSetup clubId={active.club_id} clubName={active.club_name} />
      </div>
    )
  }

  const ownerId = await effectiveOwnerId(alliance)
  const [standings, isOwner] = await Promise.all([
    loadStandings(alliance.alliance_id),
    ownerId ? ownsClub(session, ownerId) : Promise.resolve(false),
  ])
  // which clubs this user can take out themselves (their own) vs only as owner
  const ownClubs = new Set(
    (await Promise.all(standings.clubs.map(async c => ((await ownsClub(session, c.club_id)) ? c.club_id : null))))
      .filter((x): x is string => !!x)
  )

  return (
    <div className="rise space-y-6">
      <PageHeader
        title={alliance.name}
        description="Every club in the alliance, ranked together. Members can pull this up in Discord with /alliance."
        meta={
          <>
            <Chip tone="brand">Alliance</Chip>
            <Chip tone={alliance.is_public ? 'good' : 'neutral'}>{alliance.is_public ? 'Public' : 'Private'}</Chip>
          </>
        }
        actions={
          alliance.is_public ? (
            <Link href={`/alliance/${alliance.slug}`} className="btn btn-secondary" target="_blank">
              Public page <ExternalLink size={14} strokeWidth={1.75} />
            </Link>
          ) : undefined
        }
      />

      <AllianceManager
        alliance={{ ...alliance, invite_code: isOwner ? alliance.invite_code : '' }}
        clubs={standings.clubs.map(c => ({
          club_id: c.club_id,
          club_name: c.club_name,
          is_owner: c.club_id === ownerId,
          can_leave: ownClubs.has(c.club_id),
        }))}
        isOwner={isOwner}
        activeClubId={active.club_id}
      />

      <Leaderboard standings={standings} />
    </div>
  )
}
