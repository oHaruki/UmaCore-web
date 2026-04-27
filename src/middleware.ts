import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isAuthed = !!req.auth
  const { pathname } = req.nextUrl

  // Protect all API routes and dashboard pages
  const isProtected = pathname.startsWith('/api/') || pathname.startsWith('/dashboard')

  // Allow auth callback through unconditionally
  if (pathname.startsWith('/api/auth')) return NextResponse.next()

  if (isProtected && !isAuthed) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*'],
}
