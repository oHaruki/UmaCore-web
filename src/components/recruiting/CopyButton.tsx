'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CopyButton({ value, label, className = 'btn btn-secondary' }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        }).catch(() => {})
      }}
      className={className}
    >
      {done ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.75} />}
      {done ? 'Copied' : label}
    </button>
  )
}
