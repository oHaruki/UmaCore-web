import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { UUID_RE } from '@/lib/recruiting'
import {
  NAME_MAX, canManageAlliance, cleanName, effectiveOwnerId, getAlliance, newInviteCode, uniqueSlug,
} from '@/lib/alliance'

type Ctx = { params: Promise<{ id: string }> }

async function guard(ctx: Ctx) {
  const session = await auth()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id } = await ctx.params
  const alliance = UUID_RE.test(id) ? await getAlliance(id) : null
  if (!alliance) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  if (!(await canManageAlliance(session, alliance)))
    return { error: NextResponse.json({ error: 'Only the owner club can change this' }, { status: 403 }) }
  return { session, alliance }
}

/** Rename, make public or private, or roll a new invite code. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const g = await guard(ctx)
  if ('error' in g) return g.error
  const { session, alliance } = g

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  let name = alliance.name
  let slug = alliance.slug
  if (body.name !== undefined) {
    name = cleanName(body.name)
    if (name.length < 2 || name.length > NAME_MAX)
      return NextResponse.json({ error: `Pick a name between 2 and ${NAME_MAX} characters` }, { status: 400 })
    if (name !== alliance.name) slug = await uniqueSlug(name, alliance.alliance_id)
  }
  const isPublic = typeof body.is_public === 'boolean' ? body.is_public : alliance.is_public
  const code = body.new_code === true ? newInviteCode() : alliance.invite_code

  const row = await queryOne<{ slug: string; invite_code: string }>(
    `UPDATE alliances SET name = $2, slug = $3, is_public = $4, invite_code = $5, updated_at = NOW()
     WHERE alliance_id = $1::uuid RETURNING slug, invite_code`,
    [alliance.alliance_id, name, slug, isPublic, code]
  ).catch(() => null)
  if (!row) return NextResponse.json({ error: 'Something clashed, try again' }, { status: 409 })

  await logAudit({
    actorId: session.user.id, actorName: session.user.name ?? 'unknown',
    action: 'alliance.update', entityType: 'alliance', entityId: alliance.alliance_id,
    clubId: await effectiveOwnerId(alliance),
    details: { name, is_public: isPublic, new_code: body.new_code === true },
  })
  return NextResponse.json({ ok: true, ...row })
}

/** Disband: every club leaves and the leaderboard goes away. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const g = await guard(ctx)
  if ('error' in g) return g.error
  const owner = await effectiveOwnerId(g.alliance)
  await query('DELETE FROM alliances WHERE alliance_id = $1::uuid', [g.alliance.alliance_id])
  await logAudit({
    actorId: g.session.user.id, actorName: g.session.user.name ?? 'unknown',
    action: 'alliance.disband', entityType: 'alliance', entityId: g.alliance.alliance_id,
    clubId: owner, details: { name: g.alliance.name },
  })
  return NextResponse.json({ ok: true })
}
