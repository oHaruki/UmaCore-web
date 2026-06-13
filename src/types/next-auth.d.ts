import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    adminGuilds: { id: string; name: string }[]
    adminGuildIds: string[]
    isOwner: boolean
    user: DefaultSession['user'] & { id: string }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    adminGuilds?: { id: string; name: string }[]
    discordId?: string
  }
}
