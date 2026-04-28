import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'

const BOT_API = process.env.BOT_API_URL ?? 'http://127.0.0.1:7890'

async function triggerRecalculate(clubId: string) {
  try {
    await fetch(`${BOT_API}/recalculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ club_id: clubId }),
      signal: AbortSignal.timeout(30000),
    })
  } catch {
    // best-effort; quota data is still correct, just not recalculated yet
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { club_id, effective_date, daily_quota } = body

  if (!club_id || !effective_date || daily_quota == null)
    return NextResponse.json({ error: 'club_id, effective_date, and daily_quota are required' }, { status: 400 })

  if (!/^\d{4}-\d{2}-\d{2}$/.test(effective_date) || isNaN(Date.parse(effective_date)))
    return NextResponse.json({ error: 'effective_date must be a valid YYYY-MM-DD date' }, { status: 400 })

  const quota = Number(daily_quota)
  if (!Number.isInteger(quota) || quota <= 0 || quota > 1_000_000_000)
    return NextResponse.json({ error: 'daily_quota must be a positive integer up to 1,000,000,000' }, { status: 400 })

  if (!(await ownsClub(session, club_id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'web'

  const rows = await query<{ id: string }>(
    `INSERT INTO quota_requirements (club_id, effective_date, daily_quota, set_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text`,
    [club_id, effective_date, daily_quota, actorName]
  )

  await triggerRecalculate(club_id)
  await logAudit({ actorId, actorName, action: 'quota_req.create', entityType: 'quota_requirement', entityId: rows[0]?.id, clubId: club_id, details: { effective_date, daily_quota: quota } })

  return NextResponse.json({ ok: true, id: rows[0]?.id })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, club_id } = await req.json()

  if (!id || !club_id)
    return NextResponse.json({ error: 'id and club_id are required' }, { status: 400 })

  if (!(await ownsClub(session, club_id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await query(
    `DELETE FROM quota_requirements WHERE id = $1 AND club_id = $2`,
    [id, club_id]
  )

  await triggerRecalculate(club_id)

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'
  await logAudit({ actorId, actorName, action: 'quota_req.delete', entityType: 'quota_requirement', entityId: id, clubId: club_id })

  return NextResponse.json({ ok: true })
}
