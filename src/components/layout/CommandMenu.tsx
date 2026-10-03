'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, CornerDownLeft, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CommandItem = {
  id: string
  group: string
  label: string
  icon: LucideIcon
  run: () => void
}

export default function CommandMenu({
  open,
  onOpenChange,
  items,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CommandItem[]
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-[oklch(0.08_0.02_285/65%)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          {/* Mounted per open, so the query and selection start fresh each time. */}
          <CommandDialog items={items} onClose={() => onOpenChange(false)} />
        </div>
      )}
    </AnimatePresence>
  )
}

function CommandDialog({ items, onClose }: { items: CommandItem[]; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q ? items.filter(i => i.label.toLowerCase().includes(q)) : items
    // Any typed text could be a trainer name, so offer a member search last.
    if (!q) return matched
    return [
      ...matched,
      {
        id: 'search-members',
        group: 'Members',
        label: `Search members for "${query.trim()}"`,
        icon: Users,
        run: () => router.push(`/dashboard/members?search=${encodeURIComponent(query.trim())}`),
      },
    ]
  }, [items, query, router])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  function choose(i: number) {
    const item = results[i]
    if (!item) return
    onClose()
    item.run()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(index) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Jump to"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
      className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line-strong bg-surface-2 shadow-[0_24px_64px_-16px_oklch(0.05_0.03_285/85%)]"
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search size={16} strokeWidth={1.75} className="text-fg-subtle" />
        <input
          autoFocus
          value={query}
          onChange={e => { setQuery(e.target.value); setIndex(0) }}
          placeholder="Go to a page, switch club, or find a trainer"
          aria-label="Search"
          className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <kbd className="kbd">Esc</kbd>
      </div>

      <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
        {results.length === 0 && (
          <p className="px-3 py-8 text-center text-[13px] text-fg-subtle">Nothing matches that.</p>
        )}
        {results.map((item, i) => {
          const header = i === 0 || results[i - 1].group !== item.group ? item.group : null
          const Icon = item.icon
          return (
            <div key={item.id}>
              {header && <p className="px-3 pt-2.5 pb-1 text-xs font-medium text-fg-subtle">{header}</p>}
              <button
                data-index={i}
                onMouseMove={() => setIndex(i)}
                onClick={() => choose(i)}
                className={cn(
                  'flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[13px] transition-colors',
                  i === index ? 'bg-surface-3 text-fg' : 'text-fg-soft'
                )}
              >
                <Icon size={16} strokeWidth={1.75} className={i === index ? 'text-brand' : 'text-fg-subtle'} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {i === index && <CornerDownLeft size={14} strokeWidth={1.75} className="text-fg-subtle" />}
              </button>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
