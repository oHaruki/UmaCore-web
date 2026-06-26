import { botApiFetch } from '@/lib/bot-api'

export type BotGuild = { id: string; name: string }

/**
 * Guilds the bot is actually a member of (id + name), from its gateway cache.
 * Returns null if the bot can't be reached.
 */
export async function getBotGuilds(): Promise<BotGuild[] | null> {
  try {
    const res = await botApiFetch('/bot_guilds', {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data.guilds) ? (data.guilds as BotGuild[]) : null
  } catch {
    return null
  }
}

/** Convenience: just the guild IDs the bot is in (null if unreachable). */
export async function getBotGuildIds(): Promise<string[] | null> {
  const guilds = await getBotGuilds()
  return guilds ? guilds.map(g => g.id) : null
}
