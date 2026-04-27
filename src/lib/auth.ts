import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'

const allowedIds = process.env.ALLOWED_DISCORD_IDS
  ?.split(',').map(s => s.trim()).filter(Boolean) ?? []

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      if (allowedIds.length === 0) return true
      return allowedIds.includes(account?.providerAccountId ?? '')
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
