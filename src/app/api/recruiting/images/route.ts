import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { accessibleClubIds } from '@/lib/guild-check'
import { LIMITS } from '@/lib/recruiting-shared'

/** Content type from the file's own bytes; the browser's claim isn't trusted. */
function sniff(b: Buffer): string | null {
  if (b.length > 8 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return 'image/png'
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

/** Upload club artwork. Returns the image id to save on the listing. */
export async function POST(req: NextRequest) {
  const session = await auth()
  const discordId = session?.user?.id ?? ''
  if (!session || !/^\d+$/.test(discordId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // artwork is only for club listings, so only people who manage a club can upload
  if (!(await accessibleClubIds(session)).length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > LIMITS.imageBytes)
    return NextResponse.json({ error: 'Image is too large, keep it under 900 KB' }, { status: 413 })

  const data = Buffer.from(await file.arrayBuffer())
  const type = sniff(data)
  if (!type) return NextResponse.json({ error: 'Use a PNG, JPEG or WebP image' }, { status: 415 })

  // drop this user's uploads that never made it onto a listing
  await query(
    `DELETE FROM recruit_images i
     WHERE i.owner_discord_id = $1::bigint AND i.created_at < NOW() - INTERVAL '1 hour'
       AND NOT EXISTS (SELECT 1 FROM recruit_club_posts p WHERE p.banner_image_id = i.image_id)`,
    [discordId]
  ).catch(() => {})

  const row = await queryOne<{ image_id: string }>(
    `INSERT INTO recruit_images (owner_discord_id, content_type, data)
     VALUES ($1::bigint, $2, $3) RETURNING image_id::text`,
    [discordId, type, data]
  )
  return NextResponse.json({ image_id: row!.image_id })
}
