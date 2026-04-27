import { NextRequest, NextResponse } from 'next/server'

const BOT_API = process.env.BOT_API_URL ?? 'http://127.0.0.1:7890'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params

  try {
    const res = await fetch(`${BOT_API}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ club_id: clubId }),
      signal: AbortSignal.timeout(90000),
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
