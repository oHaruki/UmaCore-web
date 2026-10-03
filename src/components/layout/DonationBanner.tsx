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
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand/8 px-4 py-3 text-sm">
      <Heart size={13} className="text-brand shrink-0" />
      <p className="flex-1 text-[13px] leading-relaxed text-fg-soft">
        UmaCore is entirely free.{' '}
        If you find it useful, a small{' '}
        <a
          href="https://ko-fi.com/harukidev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:text-brand-strong underline underline-offset-2 transition-colors"
        >
          Ko-fi donation
        </a>
        {' '}goes a long way to cover server costs. Thank you.
      </p>
      <button
        onClick={dismiss}
        className="text-fg-subtle hover:text-fg-muted transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}
