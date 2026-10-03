'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { cn } from '@/lib/utils'

/**
 * Makes the active club `clubId` (cookie), then opens `href`. Club pages all read
 * the active club, so this is how the Overview links into a specific club.
 */
export default function ClubCardLink({
  clubId,
  href = '/dashboard/clubs',
  className,
  children,
  label,
}: {
  clubId: string
  href?: string
  className?: string
  children: React.ReactNode
  label?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const open = () => {
    startTransition(async () => {
      await fetch('/api/active-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: clubId }),
      })
      router.push(href)
      router.refresh()
    })
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={label}
      aria-busy={pending}
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      className={cn(
        'cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        pending && 'opacity-60',
        className
      )}
    >
      {children}
    </div>
  )
}
