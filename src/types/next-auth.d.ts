import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    adminGuildIds: string[]
    user: DefaultSession['user'] & { id: string }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    adminGuildIds?: string[]
  }
}
