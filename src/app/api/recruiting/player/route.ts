import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import {
  BUMP_HOURS, LIMITS, MAX_LANGUAGES, parseLanguages, TAGS, cleanTrainerId, isGrade,
} from '@/lib/recruiting-shared'
import { lookupTrainer } from '@/lib/trainer-lookup'

const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

async function signedIn() {
  const session = await auth()
  const id = session?.user?.id ?? ''
  return session && /^\d+$/.test(id) ? { session, discordId: id } : null
}

/** Create or update the signed-in user's LFC post. */
export async function PUT(req: NextRequest) {
  const me = await signedIn()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return bad('Invalid body')

  const trainerId = cleanTrainerId(String(body.trainer_id ?? ''))
  if (!trainerId) return bad('Your trainer ID is the 9 to 12 digit number on your in-game profile')

  const description = String(body.description ?? '').trim()
  if (description.length > LIMITS.playerDescription) return bad(`Description is limited to ${LIMITS.playerDescription} characters`)

  const minGrade = body.min_grade ? String(body.min_grade) : null
  if (minGrade && !isGrade(minGrade)) return bad('Unknown club grade')

  let dailyFans: number | null = null
  if (body.daily_fans !== null && body.daily_fans !== undefined && body.daily_fans !== '') {
    dailyFans = Number(body.daily_fans)
    if (!Number.isFinite(dailyFans) || dailyFans < 0 || dailyFans > 100_000_000) return bad('Fans per day looks wrong')
    dailyFans = Math.round(dailyFans)
  }

  const language = parseLanguages(String(body.language ?? '')).slice(0, MAX_LANGUAGES).join(', ') || null
  const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => TAGS.some(x => x.id === t)) : []
  const isOpen = body.is_open !== false

  // Only ask uma.moe when the ID changed; the bot keeps existing posts fresh.
  const prev = await queryOne<{ trainer_id: string }>(
    'SELECT trainer_id FROM recruit_player_posts WHERE discord_user_id = $1::bigint', [me.discordId]
  )
  let stats: string | null = null
  let trainerName: string | null = null
  if (prev?.trainer_id !== trainerId) {
    const found = await lookupTrainer(trainerId)
    if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status })
    stats = JSON.stringify(found.trainer)
    trainerName = found.trainer.trainer_name
  }

  await query(
    `INSERT INTO recruit_player_posts
       (discord_user_id, discord_name, discord_avatar, trainer_id, trainer_name, min_grade,
        daily_fans, description, language, tags, stats, stats_updated_at, is_open)
     VALUES ($1::bigint, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW(), $12)
     ON CONFLICT (discord_user_id) DO UPDATE SET
       discord_name = EXCLUDED.discord_name, discord_avatar = EXCLUDED.discord_avatar,
       trainer_id = EXCLUDED.trainer_id,
       trainer_name = COALESCE($5, recruit_player_posts.trainer_name),
       stats = COALESCE($11::jsonb, recruit_player_posts.stats),
       stats_updated_at = CASE WHEN $11::jsonb IS NULL THEN recruit_player_posts.stats_updated_at ELSE NOW() END,
       min_grade = EXCLUDED.min_grade, daily_fans = EXCLUDED.daily_fans,
       description = EXCLUDED.description,
       language = EXCLUDED.language, tags = EXCLUDED.tags, is_open = EXCLUDED.is_open,
       updated_at = NOW(),
       bumped_at = CASE WHEN EXCLUDED.is_open AND NOT recruit_player_posts.is_open
                        THEN NOW() ELSE recruit_player_posts.bumped_at END`,
    [me.discordId, me.session.user.name ?? 'Trainer', me.session.user.image ?? null, trainerId,
     trainerName, minGrade, dailyFans, description, language, tags, stats, isOpen]
  )
  return NextResponse.json({ ok: true })
}

/** Back to the top of the board, once per BUMP_HOURS. */
export async function POST() {
  const me = await signedIn()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const row = await queryOne(
    `UPDATE recruit_player_posts SET bumped_at = NOW(), is_open = TRUE
     WHERE discord_user_id = $1::bigint AND bumped_at < NOW() - INTERVAL '${BUMP_HOURS} hours'
     RETURNING 1`,
    [me.discordId]
  )
  if (!row) return NextResponse.json({ error: `You can bump once every ${BUMP_HOURS} hours` }, { status: 429 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const me = await signedIn()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await query('DELETE FROM recruit_player_posts WHERE discord_user_id = $1::bigint', [me.discordId])
  return NextResponse.json({ ok: true })
}
