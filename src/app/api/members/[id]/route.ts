import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { is_active, manually_deactivated } = await req.json()

  await query(
    `UPDATE members SET is_active = $1, manually_deactivated = $2, updated_at = NOW() WHERE member_id = $3`,
    [is_active, manually_deactivated ?? !is_active, id]
  )

  return NextResponse.json({ ok: true })
}
