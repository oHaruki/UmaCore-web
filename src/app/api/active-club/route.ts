import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { accessibleClubIds } from '@/lib/guild-check'
import { ACTIVE_CLUB_COOKIE } from '@/lib/active-club'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { club_id } = await req.json().catch(() => ({}))
  if (!club_id) return NextResponse.json({ error: 'club_id required' }, { status: 400 })

  // Only let users select a club they can actually access.
  const ids = await accessibleClubIds(session)
  if (!ids.includes(String(club_id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const c = await cookies()
  c.set(ACTIVE_CLUB_COOKIE, String(club_id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return NextResponse.json({ ok: true })
}
