import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'

const ADMINISTRATOR = 0x8

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
      // Fetch the user's Discord guilds on initial sign-in and store which ones
      // they are Administrator in. Carried in the JWT for subsequent requests.
      if (account?.access_token) {
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
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      const guilds = Array.isArray(token.adminGuilds)
        ? token.adminGuilds.filter((g): g is { id: string; name: string } =>
            typeof g === 'object' && g !== null && typeof g.id === 'string' && typeof g.name === 'string'
          )
        : []
      session.adminGuilds = guilds
      session.adminGuildIds = guilds.map(g => g.id)
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
