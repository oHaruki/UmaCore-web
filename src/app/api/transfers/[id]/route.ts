import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'
import { botApiFetch } from '@/lib/bot-api'

type Row = {
  to_club_id: string
  status: string
  trainer_name: string
  discord_user_id: string
}

/**
 * Approve or decline one transfer request.
 *
 * The decision itself is delegated to the bot rather than written here. The bot
 * owns the only guard that makes a decision idempotent (it settles a request
 * only while it is still pending) and it is the only side that can DM the
 * requester — splitting the two would let a dashboard approval land without the
 * person ever being told, which is the whole point of the queue.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { action, reason } = await req.json()

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 })
  }

  const rows = await query<Row>(
    `SELECT to_club_id::text AS to_club_id, status, trainer_name,
            discord_user_id::text AS discord_user_id
     FROM transfer_requests WHERE request_id = $1`,
    [id]
  )
  if (!rows.length) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const request = rows[0]
  if (!(await ownsClub(session, request.to_club_id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (request.status !== 'pending')
    return NextResponse.json({ error: 'This request was already decided' }, { status: 409 })

  const actorName = (session.user as { name?: string })?.name ?? 'Dashboard'
  const status = action === 'approve' ? 'approved' : 'rejected'

  let res: Response
  try {
    res = await botApiFetch('/transfer_decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: id,
        status,
        decided_by: actorName,
        reason: reason || null,
      }),
    })
  } catch {
    return NextResponse.json(
      { error: 'Bot is unreachable — the requester could not be notified, so nothing was changed.' },
      { status: 503 }
    )
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json({ error: data.error ?? 'Decision failed' }, { status: res.status })
  }

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  await logAudit({
    actorId,
    actorName,
    action: `transfer.${status}`,
    entityType: 'transfer_request',
    entityId: id,
    clubId: request.to_club_id,
    details: {
      trainer_name: request.trainer_name,
      discord_user_id: request.discord_user_id,
      reason: reason || null,
      notified: data.notified ?? null,
    },
  })

  return NextResponse.json({ ok: true, notified: data.notified ?? false })
}
