'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

/**
 * Wraps an Overview club card. Clicking selects the club as the active club
 * (cookie) and refreshes in place, which reveals that club's sections in the
 * sidebar and its editors panel below — without leaving the Overview.
 */
export default function ClubCardLink({
  clubId,
  children,
}: {
  clubId: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const select = () => {
    startTransition(async () => {
      await fetch('/api/active-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: clubId }),
      })
      router.refresh()
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={select}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select() } }}
      className={`cursor-pointer outline-none ${pending ? 'opacity-60' : ''}`}
    >
      {children}
    </div>
  )
}
