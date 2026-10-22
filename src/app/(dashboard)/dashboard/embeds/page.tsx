import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import { ownsClub } from '@/lib/guild-check'
import { PageHeader, NoClub, EmptyState } from '@/components/dash/ui'
import EmbedEditor from './EmbedEditor'

export default async function EmbedsPage() {
  const session = await auth()
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  if (!active) return <NoClub title="Embeds" />

  const canEdit = session ? await ownsClub(session, active.club_id) : false

  return (
    <div className="rise space-y-6">
      <PageHeader
        title="Embeds"
        description={`How ${active.club_name}'s daily report and live board look in Discord, and how days behind are counted. The preview uses your club's own numbers.`}
      />
      {canEdit ? (
        <EmbedEditor key={active.club_id} clubId={active.club_id} />
      ) : (
        <div className="panel">
          <EmptyState title="Admins and editors only" body="Only people who can manage this club can change how its embeds look." />
        </div>
      )}
    </div>
  )
}
