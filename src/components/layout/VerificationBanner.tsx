'use client'

import { useState, useEffect } from 'react'
import { X, AlertCircle } from 'lucide-react'

const STORAGE_KEY = 'verification-banner-dismissed'

export default function VerificationBanner() {
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
    <div className="flex items-center gap-3 px-4 py-2.5 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
      <AlertCircle size={13} className="text-amber-400 shrink-0" />
      <p className="text-zinc-300 flex-1 text-xs leading-relaxed">
        UmaCore has reached 100 servers and is currently pending Discord verification.{' '}
        The bot <span className="text-white font-medium">cannot join new servers</span> until approved.{' '}
        Existing servers are unaffected.
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
