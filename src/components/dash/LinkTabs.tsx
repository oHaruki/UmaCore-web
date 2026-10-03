'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type LinkTab = { label: string; href: string; count?: number; current: boolean }

/** URL-driven tabs; the underline slides to the current one. */
export default function LinkTabs({ tabs, id }: { tabs: LinkTab[]; id: string }) {
  const reduce = useReducedMotion()
  return (
    <nav className="flex items-center gap-1 border-b border-line" aria-label="Filter">
      {tabs.map(t => (
        <Link
          key={t.label}
          href={t.href}
          scroll={false}
          aria-current={t.current ? 'page' : undefined}
          className={cn(
            'relative -mb-px flex h-10 items-center gap-2 px-3 text-[13px] font-medium transition-colors',
            t.current ? 'text-fg' : 'text-fg-muted hover:text-fg'
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn('num rounded-md px-1.5 text-[11px] leading-5', t.current ? 'bg-brand/16 text-brand' : 'bg-surface-3 text-fg-subtle')}>
              {t.count}
            </span>
          )}
          {t.current && (
            <motion.span
              layoutId={`tab-${id}`}
              className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-solid"
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
        </Link>
      ))}
    </nav>
  )
}
