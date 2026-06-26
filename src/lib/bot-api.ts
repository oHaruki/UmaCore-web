const BOT_API = process.env.BOT_API_URL ?? 'http://127.0.0.1:7890'

/** Server-side fetch to the bot's internal HTTP API (includes auth header). */
export function botApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const secret = process.env.BOT_API_SECRET
  if (!secret) {
    return Promise.reject(new Error('BOT_API_SECRET is not configured'))
  }

  const headers = new Headers(init?.headers)
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${secret}`)
  }

  return fetch(`${BOT_API}${path}`, { ...init, headers })
}
