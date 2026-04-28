import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { trainer_name, trainer_id, club_id, join_date } = await req.json()

  if (!trainer_name || !trainer_id || !club_id) {
    return NextResponse.json({ error: 'trainer_name, trainer_id and club_id are required' }, { status: 400 })
  }

  if (!(await ownsClub(session, club_id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await query(
    'SELECT member_id FROM members WHERE trainer_id = $1 AND club_id = $2',
    [trainer_id, club_id]
  )
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Member with this trainer ID already exists in this club' }, { status: 409 })
  }

  const effectiveJoinDate = join_date ?? new Date().toISOString().split('T')[0]
  const result = await query<{ member_id: string }>(
    `INSERT INTO members (member_id, trainer_name, trainer_id, club_id, join_date, is_active, manually_deactivated, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, true, false, NOW(), NOW())
     RETURNING member_id`,
    [trainer_name, trainer_id, club_id, effectiveJoinDate]
  )

  const memberId = result[0].member_id
  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'
  await logAudit({ actorId, actorName, action: 'member.create', entityType: 'member', entityId: memberId, clubId: club_id, details: { trainer_name, trainer_id, join_date: effectiveJoinDate } })

  return NextResponse.json({ member_id: memberId })
}
