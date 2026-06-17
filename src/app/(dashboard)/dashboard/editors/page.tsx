import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import { isClubAdmin } from '@/lib/guild-check'
import ClubEditors from '../settings/ClubEditors'

export default async function EditorsPage() {
  const session = await auth()
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  if (!active) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-white">Club Editors</h1>
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-10 text-center text-xs text-zinc-600">
          No club selected. Pick one from the Overview.
        </div>
      </div>
    )
  }

  const canManage = session ? await isClubAdmin(session, active.club_id) : false

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Club Editors · {active.club_name}</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Roles allowed to manage this club</p>
      </div>
      {canManage ? (
        <ClubEditors clubId={active.club_id} />
      ) : (
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-10 text-center text-xs text-zinc-600">
          Only Discord admins of this server can assign editor roles.
        </div>
      )}
    </div>
  )
}
