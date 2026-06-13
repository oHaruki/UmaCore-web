import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'

const ADMINISTRATOR = 0x8
const OWNER_ID = '139769063948681217'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: 'identify email guilds' } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        // Store the real Discord snowflake ID — token.sub is a NextAuth UUID, not the Discord ID
        token.discordId = account.providerAccountId
        try {
          const res = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${account.access_token}` },
          })
          const guilds: Array<{ id: string; name: string; permissions: string }> = await res.json()
          token.adminGuilds = guilds
            .filter(g => (Number(g.permissions) & ADMINISTRATOR) === ADMINISTRATOR)
            .map(g => ({ id: g.id, name: g.name }))
        } catch {
          token.adminGuilds = []
        }
      }
      return token
    },
    async session({ session, token }) {
      const discordId = (token.discordId as string | undefined) ?? token.sub ?? ''
      if (session.user) {
        session.user.id = discordId
      }
      const guilds = Array.isArray(token.adminGuilds)
        ? token.adminGuilds.filter((g): g is { id: string; name: string } =>
            typeof g === 'object' && g !== null && typeof g.id === 'string' && typeof g.name === 'string'
          )
        : []
      session.adminGuilds = guilds
      session.adminGuildIds = guilds.map(g => g.id)
      session.isOwner = discordId === OWNER_ID
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
