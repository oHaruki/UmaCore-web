import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'
import { UUID_RE } from '@/lib/recruiting'
import { NAME_MAX, cleanName, newInviteCode, uniqueSlug } from '@/lib/alliance'

/** Start an alliance with this club as its owner. */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const clubId = String(body?.club_id ?? '')
  const name = cleanName(body?.name)
  if (!UUID_RE.test(clubId) || !(await ownsClub(session, clubId)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (name.length < 2 || name.length > NAME_MAX)
    return NextResponse.json({ error: `Pick a name between 2 and ${NAME_MAX} characters` }, { status: 400 })

  // one statement, so a club already in an alliance leaves no empty alliance behind
  let row: { alliance_id: string } | null = null
  try {
    row = await queryOne<{ alliance_id: string }>(
      `WITH a AS (
         INSERT INTO alliances (name, slug, owner_club_id, invite_code, created_by_id)
         SELECT $1, $2, $3::uuid, $4, $5::bigint
         WHERE NOT EXISTS (SELECT 1 FROM alliance_clubs WHERE club_id = $3::uuid)
         RETURNING alliance_id
       )
       INSERT INTO alliance_clubs (club_id, alliance_id)
       SELECT $3::uuid, alliance_id FROM a
       RETURNING alliance_id::text`,
      [name, await uniqueSlug(name), clubId, newInviteCode(), session.user.id]
    )
  } catch {
    return NextResponse.json({ error: 'Something clashed, try again' }, { status: 409 })
  }
  if (!row) return NextResponse.json({ error: 'This club is already in an alliance' }, { status: 409 })

  await logAudit({
    actorId: session.user.id, actorName: session.user.name ?? 'unknown',
    action: 'alliance.create', entityType: 'alliance', entityId: row.alliance_id, clubId,
    details: { name },
  })
  return NextResponse.json({ ok: true, alliance_id: row.alliance_id })
}
