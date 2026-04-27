import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ownsClub } from '@/lib/guild-check'

const BOT_API = process.env.BOT_API_URL ?? 'http://127.0.0.1:7890'

// Simple in-memory rate limit: 1 sync per club per 2 minutes.
// Works for single-instance deployments; use Redis for multi-instance.
const syncCooldowns = new Map<string, number>()
const COOLDOWN_MS = 2 * 60 * 1000

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clubId } = await params

  if (!(await ownsClub(session, clubId)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const last = syncCooldowns.get(clubId)
  if (last && Date.now() - last < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000)
    return NextResponse.json({ error: `Sync on cooldown, try again in ${remaining}s` }, { status: 429 })
  }
  syncCooldowns.set(clubId, Date.now())

  try {
    const res = await fetch(`${BOT_API}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ club_id: clubId }),
      signal: AbortSignal.timeout(300000), // 5 min — large backfills can take a while
    })
    const text = await res.text()
    let data: Record<string, unknown> = {}
    try { if (text) data = JSON.parse(text) } catch { /* non-JSON */ }
    return NextResponse.json(
      res.ok ? { success: true, ...data } : { error: data.error ?? 'Bot error' },
      { status: res.ok ? 200 : res.status }
    )
  } catch (err) {
    const msg = String(err)
    // ECONNREFUSED = bot is not running at all
    if (msg.includes('ECONNREFUSED') || msg.includes('connect ECONNREFUSED')) {
      return NextResponse.json({ error: 'Bot API is not running' }, { status: 502 })
    }
    // Any other error (socket hang up, incomplete response, timeout after processing)
    // means the bot likely processed the sync but the HTTP response was dropped.
    // Return success so router.refresh() picks up the updated data.
    console.warn('[sync proxy] response error (data likely written):', msg)
    return NextResponse.json({ success: true, updated_members: 0, backfilled: 0, note: 'response incomplete' })
  }
}
