import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'

/**
 * Update the signed-in user's own DM preferences — the same two flags
 * `/notification_settings` writes. The row is found by the session's Discord ID,
 * so nobody can reach another person's link from here. The bot reads these per
 * notification, so a change applies from the next report with no bot call.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  const discordId = session?.user?.id
  if (!discordId || !/^\d+$/.test(discordId))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const fields = ['notify_on_bombs', 'notify_on_deficit'] as const

  const sets: string[] = []
  const vals: unknown[] = []
  for (const key of fields) {
    if (key in body) {
      if (typeof body[key] !== 'boolean')
        return NextResponse.json({ error: `${key} must be true or false` }, { status: 400 })
      vals.push(body[key])
      sets.push(`${key} = $${vals.length}`)
    }
  }
  if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  vals.push(discordId)
  const rows = await query(
    `UPDATE user_links SET ${sets.join(', ')}, updated_at = NOW()
     WHERE discord_user_id = $${vals.length}::bigint
     RETURNING member_id`,
    vals
  )
  if (!rows.length)
    return NextResponse.json({ error: 'No linked trainer — use /link_trainer in Discord first' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
