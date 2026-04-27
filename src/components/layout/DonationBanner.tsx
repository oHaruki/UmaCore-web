'use client'

import { useState, useEffect } from 'react'
import { X, Heart } from 'lucide-react'

const STORAGE_KEY = 'donation-banner-dismissed'

export default function DonationBanner() {
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
    <div className="flex items-center gap-3 px-4 py-2.5 mb-6 bg-violet-600/10 border border-violet-500/20 rounded-lg text-sm">
      <Heart size={13} className="text-violet-400 shrink-0" />
      <p className="text-zinc-300 flex-1 text-xs leading-relaxed">
        UmaCore is entirely free.{' '}
        If you find it useful, a small{' '}
        <a
          href="https://ko-fi.com/harukidev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
        >
          Ko-fi donation
        </a>
        {' '}goes a long way to cover server costs — thank you!
      </p>
      <button
        onClick={dismiss}
        className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}
