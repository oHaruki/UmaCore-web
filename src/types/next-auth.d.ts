import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    adminGuilds: { id: string; name: string }[]
    adminGuildIds: string[]
    // Discord role IDs the user holds, keyed by guild ID (only club-bearing guilds)
    guildRoles: Record<string, string[]>
    isOwner: boolean
    user: DefaultSession['user'] & { id: string }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    adminGuilds?: { id: string; name: string }[]
    guildRoles?: Record<string, string[]>
    discordId?: string
  }
}
