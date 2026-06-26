import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ownsClub } from '@/lib/guild-check'
import { logAudit } from '@/lib/audit'
import { botApiFetch } from '@/lib/bot-api'

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

  const actorId = (session.user as { id?: string })?.id ?? 'unknown'
  const actorName = (session.user as { name?: string })?.name ?? 'unknown'

  try {
    const res = await botApiFetch('/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ club_id: clubId }),
      signal: AbortSignal.timeout(300000), // 5 min — large backfills can take a while
    })
    const text = await res.text()
    let data: Record<string, unknown> = {}
    try { if (text) data = JSON.parse(text) } catch { /* non-JSON */ }

    await logAudit({ actorId, actorName, action: 'sync.trigger', entityType: 'club', entityId: clubId, clubId, details: { success: res.ok, ...( res.ok ? { updated_members: data.updated_members, backfilled: data.backfilled } : { error: data.error }) } })

    return NextResponse.json(
      res.ok ? { success: true, ...data } : { error: data.error ?? 'Bot error' },
      { status: res.ok ? 200 : res.status }
    )
  } catch (err) {
    const msg = String(err)
    // ECONNREFUSED = bot is not running at all
    if (msg.includes('ECONNREFUSED') || msg.includes('connect ECONNREFUSED')) {
      await logAudit({ actorId, actorName, action: 'sync.trigger', entityType: 'club', entityId: clubId, clubId, details: { success: false, error: 'Bot API not running' } })
      return NextResponse.json({ error: 'Bot API is not running' }, { status: 502 })
    }
    // Any other error (socket hang up, incomplete response, timeout after processing)
    // means the bot likely processed the sync but the HTTP response was dropped.
    // Return success so router.refresh() picks up the updated data.
    console.warn('[sync proxy] response error (data likely written):', msg)
    await logAudit({ actorId, actorName, action: 'sync.trigger', entityType: 'club', entityId: clubId, clubId, details: { success: true, note: 'response incomplete' } })
    return NextResponse.json({ success: true, updated_members: 0, backfilled: 0, note: 'response incomplete' })
  }
}
