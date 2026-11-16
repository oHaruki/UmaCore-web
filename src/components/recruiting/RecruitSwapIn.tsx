'use client'

import { useLayoutEffect, useRef } from 'react'

/** Slides the board in when we arrive from the landing's "Find a club" link. */
export default function RecruitSwapIn({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    if (!root.classList.contains('swap-to-recruit')) return
    root.classList.remove('swap-to-recruit')
    ref.current?.animate(
      [
        { opacity: 0, transform: 'translateX(56px)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'none', filter: 'none' },
      ],
      { duration: 460, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    )
  }, [])

  return <div ref={ref} className={className}>{children}</div>
}
