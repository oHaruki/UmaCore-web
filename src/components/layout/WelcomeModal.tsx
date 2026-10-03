'use client'

import { useState, useEffect } from 'react'
import { Heart, X } from 'lucide-react'

const STORAGE_KEY = 'welcome-seen'

export default function WelcomeModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
  }, [])

  function close() {
    localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.08_0.02_285/70%)] backdrop-blur-sm">
      <div className="panel w-full max-w-sm mx-4 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 text-center relative">
          <button
            onClick={close}
            className="absolute top-4 right-4 text-fg-subtle hover:text-fg-muted transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>

          {/* Icon */}
          <div className="w-10 h-10 rounded-full bg-brand/15 flex items-center justify-center mx-auto mb-4">
            <Heart size={18} className="text-brand" />
          </div>

          <h2 className="font-display text-lg font-semibold text-fg">Welcome to UmaCore</h2>
          <p className="text-xs text-fg-muted mt-1.5 leading-relaxed">
            Quota tracking, member management and reports in one place.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-5">
          <div className="bg-surface-2/70 border border-line rounded-lg px-4 py-3.5 space-y-1.5">
            <p className="text-xs font-medium text-fg-soft">This tool is completely free</p>
            <p className="text-xs text-fg-muted leading-relaxed">
              If UmaCore saves you time, consider buying me a coffee. It helps
              keep the servers running and new features coming.
            </p>
          </div>

          <div className="space-y-2.5">
            <a
              href="https://ko-fi.com/harukidev"
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-brand-solid hover:bg-brand-solid-hover transition-colors text-xs font-medium text-brand-ink"
            >
              <Heart size={13} />
              Support on Ko-fi
            </a>
            <button
              onClick={close}
              className="w-full py-2.5 rounded-lg text-xs text-fg-muted hover:text-fg-soft hover:bg-surface-2 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
