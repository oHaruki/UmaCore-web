import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (!(await ownsClub(session, id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Must match the bot's vocabulary exactly — quota_calculator.py silently treats an
  // unrecognised period as daily, so a typo here understates a club's quota all month.
  if ('quota_period' in body && !['daily', 'weekly', 'biweekly'].includes(body.quota_period)) {
    return NextResponse.json({ error: 'quota_period must be one of: daily, weekly, biweekly' }, { status: 400 })
  }

  if (body.circle_id && !/^\d+$/.test(String(body.circle_id))) {
    return NextResponse.json({ error: 'circle_id must be numeric — copy the number from the uma.moe circle URL' }, { status: 400 })
  }

  const allowed = ['daily_quota', 'quota_period', 'is_active', 'bombs_enabled', 'bomb_trigger_days', 'bomb_countdown_days', 'timezone', 'scrape_time', 'report_channel_id', 'alert_channel_id', 'monthly_info_channel_id', 'scrape_url', 'circle_id', 'public_enabled', 'image_report_enabled', 'live_board_channel_id']
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  const changes: Record<string, unknown> = {}

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${i++}`)
      vals.push(body[key])
      changes[key] = body[key]
    }
  }

  if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  sets.push(`updated_at = NOW()`)
  vals.push(id)
  await query(`UPDATE clubs SET ${sets.join(', ')} WHERE club_id = $${i}`, vals)

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'
  await logAudit({ actorId, actorName, action: 'club.update', entityType: 'club', entityId: id, clubId: id, details: { changes } })

  return NextResponse.json({ ok: true })
}
