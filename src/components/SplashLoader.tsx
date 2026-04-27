'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function SplashLoader() {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1500)
    const t2 = setTimeout(() => setVisible(false), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#08080f] transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <Image
        src="/images/UmaViewer_2026-04-26_18-23-03-371.gif"
        alt="Loading"
        width={300}
        height={300}
        loading="eager"
        unoptimized
      />
      <p className="mt-4 text-xs font-semibold tracking-[0.3em] text-zinc-500 uppercase">
        UmaCore
      </p>
    </div>
  )
}
