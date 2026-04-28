import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'

const BOT_API = process.env.BOT_API_URL ?? 'http://127.0.0.1:7890'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const memberRow = await query<{ club_id: string; trainer_name: string }>(
    'SELECT club_id, trainer_name FROM members WHERE member_id = $1', [id]
  )
  if (!memberRow[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await ownsClub(session, memberRow[0].club_id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  const allowed = ['is_active', 'manually_deactivated', 'join_date', 'trainer_name'] as const
  type Allowed = typeof allowed[number]

  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${i++}`)
      vals.push(body[key as Allowed])
    }
  }

  if (sets.length === 0)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  // Validate join_date format if provided
  if ('join_date' in body) {
    const d = body.join_date
    if (d !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d))))
      return NextResponse.json({ error: 'join_date must be YYYY-MM-DD' }, { status: 400 })
  }

  sets.push(`updated_at = NOW()`)
  vals.push(id)
  await query(`UPDATE members SET ${sets.join(', ')} WHERE member_id = $${i}`, vals)

  // Recalculate quota history when join_date changes since expected_fans depend on it
  if ('join_date' in body) {
    try {
      await fetch(`${BOT_API}/recalculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: memberRow[0].club_id }),
        signal: AbortSignal.timeout(30000),
      })
    } catch { /* best-effort */ }
  }

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'
  const action = 'is_active' in body
    ? (body.is_active ? 'member.reactivate' : 'member.deactivate')
    : 'member.update'
  const changes: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body && key !== 'is_active' && key !== 'manually_deactivated') changes[key] = body[key as Allowed]
  }
  await logAudit({
    actorId, actorName, action, entityType: 'member', entityId: id,
    clubId: memberRow[0].club_id,
    details: { trainer_name: memberRow[0].trainer_name, ...(Object.keys(changes).length ? { changes } : {}) },
  })

  return NextResponse.json({ ok: true })
}
