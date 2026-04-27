import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'

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

  const allowed = ['daily_quota', 'quota_period', 'is_active', 'bombs_enabled', 'bomb_trigger_days', 'bomb_countdown_days', 'timezone', 'scrape_time', 'report_channel_id', 'alert_channel_id', 'monthly_info_channel_id', 'scrape_url', 'circle_id']
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${i++}`)
      vals.push(body[key])
    }
  }

  if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  sets.push(`updated_at = NOW()`)
  vals.push(id)
  await query(`UPDATE clubs SET ${sets.join(', ')} WHERE club_id = $${i}`, vals)
  return NextResponse.json({ ok: true })
}
