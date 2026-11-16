import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cleanTrainerId } from '@/lib/recruiting-shared'
import { lookupTrainer } from '@/lib/trainer-lookup'

/** Who a trainer ID belongs to, so the LFC form can confirm it before saving. */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = cleanTrainerId(req.nextUrl.searchParams.get('id') ?? '')
  if (!id) return NextResponse.json({ error: 'Your trainer ID is the 9 to 12 digit number on your in-game profile' }, { status: 400 })
  const found = await lookupTrainer(id)
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status })
  return NextResponse.json({ trainer: found.trainer })
}
