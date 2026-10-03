'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

const STORAGE_KEY = 'cookie-notice-dismissed'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg mx-auto px-4">
      <div className="flex items-center gap-4 panel px-4 py-3.5 shadow-2xl">
        <p className="text-xs text-fg-muted leading-relaxed flex-1">
          We use a single session cookie to keep you signed in — no tracking, no ads.{' '}
          <Link href="/privacy" className="text-brand hover:text-brand-strong transition-colors underline underline-offset-2">
            Privacy policy
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 text-xs font-medium text-brand-ink bg-brand-solid hover:bg-brand-solid-hover transition-colors px-3 py-1.5 rounded-lg"
        >
          Got it
        </button>
        <button
          onClick={dismiss}
          className="shrink-0 text-fg-subtle hover:text-fg-muted transition-colors"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
