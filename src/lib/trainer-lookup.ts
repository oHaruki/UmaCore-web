import { botApiFetch } from '@/lib/bot-api'
import type { TrainerStats } from '@/lib/recruiting-shared'

export type TrainerLookup =
  | { ok: true; trainer: TrainerStats }
  | { ok: false; status: number; error: string }

/** uma.moe stats for a trainer ID, through the bot so it shares the bot's API key and rate limit. */
export async function lookupTrainer(trainerId: string): Promise<TrainerLookup> {
  try {
    const res = await botApiFetch(`/recruit/trainer?id=${encodeURIComponent(trainerId)}`, {
      signal: AbortSignal.timeout(25_000),
    })
    if (res.ok) return { ok: true, trainer: (await res.json()).trainer }
    if (res.status === 404)
      return { ok: false, status: 400, error: 'uma.moe has no trainer with that ID. Check it against your in-game profile.' }
    if (res.status === 400) return { ok: false, status: 400, error: 'That is not a trainer ID' }
  } catch {
    // bot down or timed out: same answer as uma.moe being down
  }
  return { ok: false, status: 503, error: 'Couldn’t check that trainer ID with uma.moe just now. Try again in a few minutes.' }
}
