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
      <div className="flex items-center gap-4 bg-[#0d0d14] border border-white/8 rounded-xl px-4 py-3.5 shadow-2xl">
        <p className="text-xs text-zinc-400 leading-relaxed flex-1">
          We use a single session cookie to keep you signed in — no tracking, no ads.{' '}
          <Link href="/privacy" className="text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-2">
            Privacy policy
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors px-3 py-1.5 rounded-lg"
        >
          Got it
        </button>
        <button
          onClick={dismiss}
          className="shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
