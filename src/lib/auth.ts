import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'
import { query } from './db'

const ADMINISTRATOR = 0x8
const OWNER_ID = '139769063948681217'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // guilds.members.read lets us read the signed-in user's roles per guild,
      // which is how club-editor permissions are resolved.
      authorization: { params: { scope: 'identify email guilds guilds.members.read' } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        // Store the real Discord snowflake ID — token.sub is a NextAuth UUID, not the Discord ID
        token.discordId = account.providerAccountId
        let guilds: Array<{ id: string; name: string; permissions: string }> = []
        try {
          const res = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${account.access_token}` },
          })
          guilds = await res.json()
          token.adminGuilds = guilds
            .filter(g => (Number(g.permissions) & ADMINISTRATOR) === ADMINISTRATOR)
            .map(g => ({ id: g.id, name: g.name }))
        } catch {
          token.adminGuilds = []
        }

        // Resolve the user's roles, but only for guilds that actually have club-editor
        // bindings AND that the user belongs to — this bounds the number of Discord
        // member lookups to the handful of guilds where roles can matter.
        const guildRoles: Record<string, string[]> = {}
        try {
          const userGuildIds = new Set((guilds ?? []).map(g => g.id))
          // Guilds where roles matter: those with club-editor bindings OR a manager role.
          const rows = await query<{ guild_id: string }>(
            `SELECT DISTINCT c.guild_id::text AS guild_id
             FROM clubs c
             JOIN club_role_permissions crp ON crp.club_id = c.club_id
             WHERE c.guild_id IS NOT NULL
             UNION
             SELECT DISTINCT guild_id::text AS guild_id
             FROM guild_manager_roles`
          )
          const relevant = rows.map(r => r.guild_id).filter(id => userGuildIds.has(id))
          for (const gid of relevant) {
            try {
              const r = await fetch(`https://discord.com/api/users/@me/guilds/${gid}/member`, {
                headers: { Authorization: `Bearer ${account.access_token}` },
              })
              if (r.ok) {
                const member = await r.json()
                if (Array.isArray(member.roles)) guildRoles[gid] = member.roles as string[]
              }
            } catch {
              // ignore a single guild's failure; the others still resolve
            }
          }
        } catch {
          // db unavailable at login — no editor roles resolved, admins still work
        }
        token.guildRoles = guildRoles
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
      session.guildRoles =
        token.guildRoles && typeof token.guildRoles === 'object'
          ? (token.guildRoles as Record<string, string[]>)
          : {}
      session.isOwner = discordId === OWNER_ID
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
