import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import { isClubAdmin } from '@/lib/guild-check'
import ClubEditors from '../settings/ClubEditors'
import { PageHeader, NoClub, EmptyState } from '@/components/dash/ui'

export default async function EditorsPage() {
  const session = await auth()
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  if (!active) {
    return (
      <NoClub title="Editors" />
    )
  }

  const canManage = session ? await isClubAdmin(session, active.club_id) : false

  return (
    <div className="rise max-w-3xl space-y-6">
      <PageHeader title="Editors" description={`Discord roles that can manage ${active.club_name} without being server admins.`} />
      {canManage ? (
        <ClubEditors clubId={active.club_id} />
      ) : (
        <div className="panel">
          <EmptyState title="Admins only" body="Only Discord admins of this server can assign editor roles." />
        </div>
      )}
    </div>
  )
}
