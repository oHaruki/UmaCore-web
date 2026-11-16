import { NextRequest } from 'next/server'
import { queryOne } from '@/lib/db'
import { UUID_RE } from '@/lib/recruiting'

// Image ids are never reused (a new upload is a new id), so they cache forever.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return new Response('Not found', { status: 404 })
  const row = await queryOne<{ content_type: string; data: Buffer }>(
    'SELECT content_type, data FROM recruit_images WHERE image_id = $1::uuid', [id]
  ).catch(() => null)
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(row.data), {
    headers: {
      'Content-Type': row.content_type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
