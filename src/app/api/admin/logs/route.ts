import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { botApiFetch } from '@/lib/bot-api'

const OWNER_ID = '139769063948681217'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.id !== OWNER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const lines = req.nextUrl.searchParams.get('lines') ?? 'all'

  try {
    const res = await botApiFetch(`/logs?lines=${lines}`, {
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ lines: [], error: 'Bot API unreachable' }, { status: 502 })
  }
}
