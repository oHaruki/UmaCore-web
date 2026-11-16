'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

const OUT_MS = 300 // matches swapOut in the login page styles

/**
 * Way onto the recruiting board for people who don't run a club. The landing
 * slides out, then RecruitSwapIn slides the board in (it watches the html class).
 */
export default function FindClubLink() {
  const router = useRouter()
  useEffect(() => { router.prefetch('/recruiting') }, [router])

  function go(e: React.MouseEvent<HTMLAnchorElement>) {
    // let ctrl/middle click open a tab as usual
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return router.push('/recruiting')
    const root = document.documentElement
    root.classList.add('swap-to-recruit')
    setTimeout(() => router.push('/recruiting'), OUT_MS)
    // slow network: bring the landing back rather than leave a blank page
    setTimeout(() => root.classList.remove('swap-to-recruit'), 5000)
  }

  return (
    <a
      href="/recruiting"
      onClick={go}
      className="group flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3 transition-colors duration-150 hover:border-violet-500/35 hover:bg-violet-500/[0.06]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-zinc-500">Not here for the bot?</span>
        <span className="mt-0.5 block text-sm font-medium text-white">Find a club, no sign-in needed</span>
      </span>
      <ArrowRight
        size={16}
        strokeWidth={1.75}
        className="shrink-0 text-zinc-500 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-violet-400"
      />
    </a>
  )
}
