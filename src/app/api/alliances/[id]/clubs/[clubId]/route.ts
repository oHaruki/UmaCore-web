import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'
import { UUID_RE } from '@/lib/recruiting'
import { canManageAlliance, effectiveOwnerId, getAlliance } from '@/lib/alliance'

type Ctx = { params: Promise<{ id: string; clubId: string }> }

/**
 * Take a club out of the alliance: its own managers leaving, or the owner
 * removing it. When the owner club leaves, the next oldest club takes over;
 * when the last club leaves, the alliance is gone.
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, clubId } = await ctx.params
  if (!UUID_RE.test(id) || !UUID_RE.test(clubId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const alliance = await getAlliance(id)
  const member = alliance && await queryOne(
    'SELECT 1 FROM alliance_clubs WHERE alliance_id = $1::uuid AND club_id = $2::uuid', [id, clubId]
  )
  if (!alliance || !member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const leaving = await ownsClub(session, clubId)
  if (!leaving && !(await canManageAlliance(session, alliance)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const owner = await effectiveOwnerId(alliance)
  await query('DELETE FROM alliance_clubs WHERE club_id = $1::uuid', [clubId])

  let disbanded = false
  if (owner === clubId) {
    const next = await queryOne<{ club_id: string }>(
      'SELECT club_id::text FROM alliance_clubs WHERE alliance_id = $1::uuid ORDER BY joined_at LIMIT 1', [id]
    )
    if (next) {
      await query(
        'UPDATE alliances SET owner_club_id = $2::uuid, updated_at = NOW() WHERE alliance_id = $1::uuid',
        [id, next.club_id]
      )
    } else {
      await query('DELETE FROM alliances WHERE alliance_id = $1::uuid', [id])
      disbanded = true
    }
  }

  await logAudit({
    actorId: session.user.id, actorName: session.user.name ?? 'unknown',
    action: leaving ? 'alliance.leave' : 'alliance.remove_club', entityType: 'alliance', entityId: id,
    clubId, details: { name: alliance.name, disbanded },
  })
  return NextResponse.json({ ok: true, disbanded })
}
