import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'
import { UUID_RE } from '@/lib/recruiting'
import { MAX_CLUBS, normalizeCode } from '@/lib/alliance'

/** Join an alliance with the invite code its owner shared. */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const clubId = String(body?.club_id ?? '')
  const code = normalizeCode(String(body?.code ?? ''))
  if (!UUID_RE.test(clubId) || !(await ownsClub(session, clubId)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const alliance = code
    ? await queryOne<{ alliance_id: string; name: string; clubs: number }>(
        `SELECT a.alliance_id::text, a.name,
                (SELECT COUNT(*)::int FROM alliance_clubs ac WHERE ac.alliance_id = a.alliance_id) AS clubs
         FROM alliances a WHERE a.invite_code = $1`,
        [code]
      )
    : null
  if (!alliance)
    return NextResponse.json({ error: 'No alliance has that code. Ask its owner for a fresh one' }, { status: 404 })
  if (alliance.clubs >= MAX_CLUBS)
    return NextResponse.json({ error: `${alliance.name} is full (${MAX_CLUBS} clubs)` }, { status: 409 })

  const joined = await queryOne(
    `INSERT INTO alliance_clubs (club_id, alliance_id) VALUES ($1::uuid, $2::uuid)
     ON CONFLICT (club_id) DO NOTHING RETURNING club_id`,
    [clubId, alliance.alliance_id]
  )
  if (!joined)
    return NextResponse.json({ error: 'This club is already in an alliance. Leave it first' }, { status: 409 })

  await logAudit({
    actorId: session.user.id, actorName: session.user.name ?? 'unknown',
    action: 'alliance.join', entityType: 'alliance', entityId: alliance.alliance_id, clubId,
    details: { name: alliance.name },
  })
  return NextResponse.json({ ok: true, alliance_id: alliance.alliance_id })
}
