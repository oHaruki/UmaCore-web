import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { club_name, scrape_url, circle_id, guild_id, daily_quota, quota_period, timezone, scrape_time, bombs_enabled, bomb_trigger_days, bomb_countdown_days } = body

  if (!club_name || !guild_id || !daily_quota) {
    return NextResponse.json({ error: 'club_name, guild_id and daily_quota are required' }, { status: 400 })
  }

  let guildIdStr: string
  try {
    guildIdStr = BigInt(guild_id).toString()
  } catch {
    return NextResponse.json({ error: 'Invalid guild_id' }, { status: 400 })
  }
  if (!session.adminGuildIds?.includes(guildIdStr))
    return NextResponse.json({ error: 'Forbidden — you are not an admin of that server' }, { status: 403 })

  const result = await query<{ club_id: string }>(`
    INSERT INTO clubs (
      club_id, club_name, scrape_url, circle_id, guild_id, daily_quota, quota_period,
      timezone, scrape_time, is_active, bombs_enabled,
      bomb_trigger_days, bomb_countdown_days, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6,
      $7, $8, true, $9,
      $10, $11, NOW(), NOW()
    ) RETURNING club_id
  `, [
    club_name,
    scrape_url || null,
    circle_id || null,
    BigInt(guild_id),
    Number(daily_quota),
    quota_period || 'daily',
    timezone || 'Europe/Amsterdam',
    scrape_time || '16:00:00',
    bombs_enabled ?? true,
    bomb_trigger_days ?? 3,
    bomb_countdown_days ?? 7,
  ])

  const clubId = result[0].club_id
  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'
  await logAudit({ actorId, actorName, action: 'club.create', entityType: 'club', entityId: clubId, clubId, details: { club_name, daily_quota: Number(daily_quota), quota_period: quota_period || 'daily' } })

  return NextResponse.json({ club_id: clubId })
}
