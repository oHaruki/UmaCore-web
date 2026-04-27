import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { club_name, scrape_url, circle_id, guild_id, daily_quota, quota_period, timezone, scrape_time, bombs_enabled, bomb_trigger_days, bomb_countdown_days } = body

  if (!club_name || !guild_id || !daily_quota) {
    return NextResponse.json({ error: 'club_name, guild_id and daily_quota are required' }, { status: 400 })
  }

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

  return NextResponse.json({ club_id: result[0].club_id })
}
