import Link from 'next/link'
import { ExternalLink, Megaphone } from 'lucide-react'
import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import { getClubForEditor, getLinkedTrainer, getPlayerPostByDiscord } from '@/lib/recruiting'
import LinkTabs from '@/components/dash/LinkTabs'
import { EmptyState, PageHeader } from '@/components/dash/ui'
import ClubPostEditor from './ClubPostEditor'
import PlayerPostEditor from './PlayerPostEditor'

export const metadata = { title: 'Recruiting' }

export default async function RecruitingEditorPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = (await auth())!
  const discordId = session.user.id
  const { active } = await resolveActiveClub(session)
  const sp = await searchParams
  const tab = sp.tab === 'player' || (!active && sp.tab !== 'club') ? 'player' : 'club'

  const [club, post, linked] = await Promise.all([
    tab === 'club' && active ? getClubForEditor(active.club_id).catch(() => null) : null,
    tab === 'player' ? getPlayerPostByDiscord(discordId).catch(() => null) : null,
    tab === 'player' ? getLinkedTrainer(discordId).catch(() => null) : null,
  ])

  return (
    <div className="rise space-y-6">
      <PageHeader
        title="Recruiting"
        description="List your club on the public recruiting board, or post that you're looking for one. Anyone can browse the board without signing in."
        actions={
          <Link href="/recruiting" className="btn btn-secondary">
            Open the board <ExternalLink size={14} strokeWidth={1.75} />
          </Link>
        }
      />

      <LinkTabs
        id="recruiting-editor"
        tabs={[
          { label: active ? `${active.club_name} listing` : 'Club listing', href: '/dashboard/recruiting?tab=club', current: tab === 'club' },
          { label: 'Looking for a club', href: '/dashboard/recruiting?tab=player', current: tab === 'player' },
        ]}
      />

      {tab === 'club' ? (
        club ? (
          <ClubPostEditor key={club.club_id} club={club} exists={club.has_post} />
        ) : (
          <div className="panel">
            <EmptyState
              icon={Megaphone}
              title="No club to list"
              body="Club listings are for clubs tracked by UmaCore, so their stats can be shown. Add your club from the Overview, or ask its admin for editor access."
              action={<Link href="/dashboard" className="btn btn-secondary">Go to Overview</Link>}
            />
          </div>
        )
      ) : (
        <PlayerPostEditor
          post={post}
          linked={linked}
          me={{ discordId, name: session.user.name ?? 'Trainer', image: session.user.image ?? null }}
        />
      )}
    </div>
  )
}
