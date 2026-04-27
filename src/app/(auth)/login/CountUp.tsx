'use client'

import { useEffect, useState } from 'react'

function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4)
}

function formatFans(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

export default function CountUp({
  value,
  duration = 1500,
  formatAs = 'number',
}: {
  value: number
  duration?: number
  formatAs?: 'fans' | 'number'
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value <= 0) return

    let timer: ReturnType<typeof setInterval>

    function start() {
      clearInterval(timer)
      setDisplay(0)
      const t0 = Date.now()
      timer = setInterval(() => {
        const t = Math.min((Date.now() - t0) / duration, 1)
        setDisplay(Math.round(easeOutQuart(t) * value))
        if (t >= 1) clearInterval(timer)
      }, 16)
    }

    start()

    // Restart when browser restores page from bfcache (back/forward nav, some refreshes)
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) start()
    }
    window.addEventListener('pageshow', onPageShow)

    return () => {
      clearInterval(timer)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [value, duration])

  return <>{formatAs === 'fans' ? formatFans(display) : display.toLocaleString()}</>
}
