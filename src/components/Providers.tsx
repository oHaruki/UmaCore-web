'use client'

import { SessionProvider } from 'next-auth/react'
import SplashLoader from './SplashLoader'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SplashLoader />
      {children}
    </SessionProvider>
  )
}
