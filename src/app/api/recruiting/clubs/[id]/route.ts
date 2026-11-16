import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'
import { UUID_RE } from '@/lib/recruiting'
import {
  ACCENTS, BUMP_HOURS, LIMITS, MAX_LANGUAGES, parseLanguages, TAGS, normalizeInvite,
} from '@/lib/recruiting-shared'

type Ctx = { params: Promise<{ id: string }> }

async function guard(ctx: Ctx) {
  const session = await auth()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id } = await ctx.params
  if (!UUID_RE.test(id) || !(await ownsClub(session, id)))
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { session, id }
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

/** Create or update the club's listing. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const g = await guard(ctx)
  if ('error' in g) return g.error
  const { session, id } = g

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return bad('Invalid body')

  const headline = String(body.headline ?? '').trim()
  const description = String(body.description ?? '').trim()
  if (!headline) return bad('Add a headline')
  if (headline.length > LIMITS.headline) return bad(`Headline is limited to ${LIMITS.headline} characters`)
  if (description.length > LIMITS.clubDescription) return bad(`Description is limited to ${LIMITS.clubDescription} characters`)

  let invite: string | null = null
  if (body.discord_invite) {
    invite = normalizeInvite(String(body.discord_invite))
    if (!invite) return bad('That is not a Discord invite link (discord.gg/…)')
  }
  const discordRequired = body.discord_required === true
  if (discordRequired && !invite) return bad('Add an invite link if Discord is required')

  let minDaily: number | null = null
  if (body.min_daily_fans !== null && body.min_daily_fans !== undefined && body.min_daily_fans !== '') {
    minDaily = Number(body.min_daily_fans)
    if (!Number.isFinite(minDaily) || minDaily < 0 || minDaily > 100_000_000) return bad('Minimum fans per day looks wrong')
    minDaily = Math.round(minDaily)
  }

  const language = parseLanguages(String(body.language ?? '')).slice(0, MAX_LANGUAGES).join(', ') || null
  const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => TAGS.some(x => x.id === t)) : []
  const accent = body.accent && (ACCENTS as readonly string[]).includes(body.accent) ? String(body.accent) : null
  const isOpen = body.is_open !== false

  const prev = await queryOne<{ banner_image_id: string | null }>(
    'SELECT banner_image_id::text FROM recruit_club_posts WHERE club_id = $1::uuid', [id]
  )

  let banner: string | null = null
  if (body.banner_image_id) {
    banner = String(body.banner_image_id)
    // the club's current banner, or one this user just uploaded; never another club's
    const owned = banner === prev?.banner_image_id || (UUID_RE.test(banner) && await queryOne(
      `SELECT 1 FROM recruit_images i
       WHERE i.image_id = $1::uuid AND i.owner_discord_id = $2::bigint
         AND NOT EXISTS (SELECT 1 FROM recruit_club_posts p
                         WHERE p.banner_image_id = i.image_id AND p.club_id <> $3::uuid)`,
      [banner, session.user.id, id]
    ))
    if (!owned) return bad('Upload the banner again')
  }

  await query(
    `INSERT INTO recruit_club_posts
       (club_id, headline, description, discord_invite, discord_required, min_daily_fans,
        language, tags, accent, banner_image_id, is_open, updated_by_id, updated_by_name)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid, $11, $12::bigint, $13)
     ON CONFLICT (club_id) DO UPDATE SET
       headline = EXCLUDED.headline, description = EXCLUDED.description,
       discord_invite = EXCLUDED.discord_invite, discord_required = EXCLUDED.discord_required,
       min_daily_fans = EXCLUDED.min_daily_fans,
       language = EXCLUDED.language, tags = EXCLUDED.tags, accent = EXCLUDED.accent,
       banner_image_id = EXCLUDED.banner_image_id, is_open = EXCLUDED.is_open,
       updated_by_id = EXCLUDED.updated_by_id, updated_by_name = EXCLUDED.updated_by_name,
       updated_at = NOW(),
       -- reopening a closed listing puts it back on top
       bumped_at = CASE WHEN EXCLUDED.is_open AND NOT recruit_club_posts.is_open
                        THEN NOW() ELSE recruit_club_posts.bumped_at END`,
    [id, headline, description, invite, discordRequired, minDaily, language, tags,
     accent, banner, isOpen, session.user.id, session.user.name ?? 'unknown']
  )

  if (prev?.banner_image_id && prev.banner_image_id !== banner) {
    await query('DELETE FROM recruit_images WHERE image_id = $1::uuid', [prev.banner_image_id]).catch(() => {})
  }

  await logAudit({
    actorId: session.user.id, actorName: session.user.name ?? 'unknown',
    action: prev ? 'recruiting.update' : 'recruiting.create', entityType: 'recruit_post',
    entityId: id, clubId: id, details: { is_open: isOpen },
  })
  return NextResponse.json({ ok: true })
}

/** Move the listing back to the top, once per BUMP_HOURS. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const g = await guard(ctx)
  if ('error' in g) return g.error
  const row = await queryOne<{ bumped_at: string }>(
    `UPDATE recruit_club_posts SET bumped_at = NOW(), is_open = TRUE
     WHERE club_id = $1::uuid AND bumped_at < NOW() - INTERVAL '${BUMP_HOURS} hours'
     RETURNING bumped_at::text`,
    [g.id]
  )
  if (!row) return NextResponse.json({ error: `You can bump once every ${BUMP_HOURS} hours` }, { status: 429 })
  return NextResponse.json({ ok: true, bumped_at: row.bumped_at })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const g = await guard(ctx)
  if ('error' in g) return g.error
  const prev = await queryOne<{ banner_image_id: string | null }>(
    'DELETE FROM recruit_club_posts WHERE club_id = $1::uuid RETURNING banner_image_id::text', [g.id]
  )
  if (prev?.banner_image_id) {
    await query('DELETE FROM recruit_images WHERE image_id = $1::uuid', [prev.banner_image_id]).catch(() => {})
  }
  await logAudit({
    actorId: g.session.user.id, actorName: g.session.user.name ?? 'unknown',
    action: 'recruiting.delete', entityType: 'recruit_post', entityId: g.id, clubId: g.id,
  })
  return NextResponse.json({ ok: true })
}
