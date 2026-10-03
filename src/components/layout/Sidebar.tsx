'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { signOut } from 'next-auth/react'
import {
  LayoutGrid, UserRound, BookOpen, Gauge, Users, ArrowLeftRight, FileBarChart2, History,
  Bomb, Settings, ClipboardList, KeyRound, Sparkles, PlusCircle, ShieldAlert, Activity,
  LogOut, Menu, X, Search, ChevronsUpDown, Check, LayoutDashboard,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initials, nameHue } from '@/lib/format'
import CommandMenu, { type CommandItem } from './CommandMenu'

export type SidebarClub = { club_id: string; club_name: string; is_active: boolean }
type NavItem = { label: string; href: string; icon: LucideIcon; badge?: number; badgeTone?: 'bad' | 'brand' }

const BOT_INVITE_URL =
  'https://discord.com/oauth2/authorize?client_id=1467295225184784488&permissions=83968&integration_type=0&scope=bot+applications.commands'

// Last changelog version this browser has opened, so "What's new" only shows a dot for unread releases.
const SEEN_KEY = 'changelog-seen'
const seenListeners = new Set<() => void>()

function subscribeSeen(cb: () => void) {
  seenListeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    seenListeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

function readSeen() {
  try { return localStorage.getItem(SEEN_KEY) } catch { return null }
}

function markSeen(version: string) {
  try { localStorage.setItem(SEEN_KEY, version) } catch { /* storage blocked: the dot just stays */ }
  seenListeners.forEach(cb => cb())
}

export default function Sidebar({
  isOwner = false,
  clubs,
  activeId,
  counts,
  user,
  latestVersion,
}: {
  isOwner?: boolean
  clubs: SidebarClub[]
  activeId: string | null
  counts: { bombs: number; transfers: number }
  user: { name: string | null; image: string | null }
  latestVersion: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawer, setDrawer] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [switching, startSwitch] = useTransition()

  const active = clubs.find(c => c.club_id === activeId) ?? null

  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setDrawer(false)
  }

  const seenVersion = useSyncExternalStore(subscribeSeen, readSeen, () => latestVersion)
  const unread = seenVersion !== latestVersion
  useEffect(() => {
    if (pathname === '/dashboard/changelog') markSeen(latestVersion)
  }, [pathname, latestVersion])

  const general: NavItem[] = [
    { label: 'Overview', href: '/dashboard', icon: LayoutGrid },
    { label: 'My trainer', href: '/dashboard/me', icon: UserRound },
  ]
  const club: NavItem[] = active
    ? [
        { label: 'Club home', href: '/dashboard/clubs', icon: Gauge },
        { label: 'Members', href: '/dashboard/members', icon: Users },
        { label: 'Reports', href: '/dashboard/reports', icon: FileBarChart2 },
        { label: 'Quota history', href: '/dashboard/quota', icon: History },
        { label: 'Bombs', href: '/dashboard/bombs', icon: Bomb, badge: counts.bombs, badgeTone: 'bad' },
        { label: 'Transfers', href: '/dashboard/transfers', icon: ArrowLeftRight, badge: counts.transfers, badgeTone: 'brand' },
      ]
    : []
  const manage: NavItem[] = active
    ? [
        { label: 'Settings', href: '/dashboard/settings', icon: Settings },
        { label: 'Editors', href: '/dashboard/editors', icon: KeyRound },
        { label: 'Audit log', href: '/dashboard/audit-log', icon: ClipboardList },
      ]
    : []
  const help: NavItem[] = [
    { label: 'Guide', href: '/dashboard/guide', icon: BookOpen },
    { label: "What's new", href: '/dashboard/changelog', icon: Sparkles },
  ]
  const owner: NavItem[] = isOwner
    ? [
        { label: 'Admin', href: '/dashboard/admin', icon: ShieldAlert },
        { label: 'API usage', href: '/dashboard/admin/api-usage', icon: Activity },
      ]
    : []

  function switchClub(id: string) {
    if (id === activeId) return
    startSwitch(async () => {
      await fetch('/api/active-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: id }),
      })
      // A member page belongs to one club, so it can't follow the switch.
      if (/^\/dashboard\/members\/[^/]+$/.test(pathname)) router.push('/dashboard/members')
      else router.refresh()
    })
  }

  const commands: CommandItem[] = [
    ...[...general, ...club, ...manage, ...help, ...owner].map(i => ({
      id: `nav:${i.href}`,
      group: 'Go to',
      label: i.label,
      icon: i.icon,
      run: () => router.push(i.href),
    })),
    ...clubs
      .filter(c => c.club_id !== activeId)
      .map(c => ({
        id: `club:${c.club_id}`,
        group: 'Switch club',
        label: c.club_name,
        icon: LayoutDashboard,
        run: () => switchClub(c.club_id),
      })),
  ]

  const body = (variant: 'rail' | 'drawer') => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <span className="relative size-8 overflow-hidden rounded-[30%] bg-brand/15 ring-1 ring-brand/25">
          <Image src="/images/sakura_face.webp" alt="" fill sizes="32px" className="object-cover" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-semibold tracking-[-0.01em] text-fg">UmaCore</p>
          <p className="text-[11px] text-fg-subtle">Club dashboard</p>
        </div>
        <button
          onClick={() => setDrawer(false)}
          className="btn btn-ghost btn-xs ml-auto md:hidden"
          aria-label="Close menu"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Club switcher */}
      {clubs.length > 0 && (
        <div className="px-3">
          <ClubSwitcher clubs={clubs} active={active} onSelect={switchClub} pending={switching} />
        </div>
      )}

      {/* Search */}
      <div className="px-3 pt-2">
        <button
          onClick={() => setCommandOpen(true)}
          className="group flex h-9 w-full items-center gap-2 rounded-[10px] border border-line bg-surface/60 px-3 text-[13px] text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted"
        >
          <Search size={14} strokeWidth={1.75} />
          Jump to…
          <span className="ml-auto flex gap-1">
            <kbd className="kbd">Ctrl</kbd>
            <kbd className="kbd">K</kbd>
          </span>
        </button>
      </div>

      <nav className="mt-3 flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Dashboard">
        <NavGroup items={general} pathname={pathname} indicator={variant} />
        {club.length > 0 && <NavGroup label="Club" items={club} pathname={pathname} indicator={variant} />}
        {manage.length > 0 && <NavGroup label="Manage" items={manage} pathname={pathname} indicator={variant} />}
        {!active && clubs.length === 0 && (
          <p className="px-3 text-xs leading-relaxed text-fg-subtle">
            Club pages appear here once you add a club or get editor access to one.
          </p>
        )}
        <NavGroup label="Help" items={help} pathname={pathname} indicator={variant} dotHref={unread ? '/dashboard/changelog' : undefined} />
        {owner.length > 0 && <NavGroup label="Owner" items={owner} pathname={pathname} indicator={variant} />}
      </nav>

      {/* Footer */}
      <div className="space-y-1 border-t border-line px-3 py-3">
        <a
          href={BOT_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-3 rounded-[10px] px-3 text-[13px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <PlusCircle size={16} strokeWidth={1.75} />
          Add to server
        </a>
        <div className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5">
          {user.image ? (
            // Discord CDN avatar; not worth routing through the image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="size-7 rounded-[30%] object-cover" />
          ) : (
            <span className="grid size-7 place-items-center rounded-[30%] bg-surface-3 text-[11px] font-semibold text-fg-soft">
              {initials(user.name ?? '?')}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[13px] text-fg-soft">{user.name ?? 'Signed in'}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn btn-ghost btn-xs"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-canvas/85 px-3 backdrop-blur-md md:hidden">
        <button onClick={() => setDrawer(true)} className="btn btn-ghost btn-sm" aria-label="Open menu">
          <Menu size={18} strokeWidth={1.75} />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{active?.club_name ?? 'UmaCore'}</p>
        <button onClick={() => setCommandOpen(true)} className="btn btn-ghost btn-sm" aria-label="Search">
          <Search size={17} strokeWidth={1.75} />
        </button>
      </div>

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-[var(--uc-sidebar)] md:block">
        {body('rail')}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-[oklch(0.08_0.02_285/70%)] md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] border-r border-line bg-[var(--uc-sidebar)] md:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              {body('drawer')}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} items={commands} />
    </>
  )
}

function NavGroup({
  label,
  items,
  pathname,
  indicator,
  dotHref,
}: {
  label?: string
  items: NavItem[]
  pathname: string
  indicator: string
  dotHref?: string
}) {
  const reduce = useReducedMotion()
  return (
    <div>
      {label && <p className="px-3 pb-1.5 text-xs font-medium text-fg-subtle">{label}</p>}
      <ul className="space-y-0.5">
        {items.map(({ label, href, icon: Icon, badge, badgeTone }) => {
          const current = href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'relative flex h-9 items-center gap-3 rounded-[10px] px-3 text-[13px] transition-colors duration-150',
                  current ? 'text-fg' : 'text-fg-muted hover:bg-surface-2/70 hover:text-fg'
                )}
              >
                {current && (
                  <motion.span
                    layoutId={`nav-current-${indicator}`}
                    className="absolute inset-0 rounded-[10px] border border-line-strong bg-surface-2"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon size={16} strokeWidth={1.75} className={cn('relative', current && 'text-brand')} />
                <span className="relative">{label}</span>
                {!!badge && (
                  <span
                    className={cn(
                      'num relative ml-auto min-w-5 rounded-md px-1.5 text-center text-[11px] font-semibold leading-5',
                      badgeTone === 'bad' ? 'bg-bad/16 text-bad' : 'bg-brand/16 text-brand'
                    )}
                  >
                    {badge}
                  </span>
                )}
                {dotHref === href && (
                  <span className="relative ml-auto size-1.5 rounded-full bg-brand-solid" aria-label="Unread updates" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ClubSwitcher({
  clubs,
  active,
  onSelect,
  pending,
}: {
  clubs: SidebarClub[]
  active: SidebarClub | null
  onSelect: (id: string) => void
  pending: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const single = clubs.length === 1

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const name = active?.club_name ?? 'Pick a club'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !single && setOpen(o => !o)}
        disabled={pending}
        aria-haspopup={single ? undefined : 'listbox'}
        aria-expanded={single ? undefined : open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface p-2 text-left transition-colors',
          !single && 'hover:border-line-strong hover:bg-surface-2',
          pending && 'opacity-60'
        )}
      >
        <ClubMark name={name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-fg">{name}</span>
          <span className="block text-[11px] text-fg-subtle">
            {pending ? 'Switching…' : single ? 'Your club' : `${clubs.length} clubs`}
          </span>
        </span>
        {!single && <ChevronsUpDown size={15} strokeWidth={1.75} className="text-fg-subtle" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 origin-top overflow-y-auto rounded-xl border border-line-strong bg-surface-2 p-1 shadow-[0_16px_40px_-12px_oklch(0.05_0.03_285/80%)]"
          >
            {clubs.map(c => {
              const current = c.club_id === active?.club_id
              return (
                <li key={c.club_id}>
                  <button
                    role="option"
                    aria-selected={current}
                    onClick={() => { setOpen(false); onSelect(c.club_id) }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg"
                  >
                    <ClubMark name={c.club_name} small />
                    <span className="min-w-0 flex-1 truncate">{c.club_name}</span>
                    {!c.is_active && <span className="text-[11px] text-fg-subtle">inactive</span>}
                    {current && <Check size={14} strokeWidth={2} className="text-brand" />}
                  </button>
                </li>
              )
            })}
            <li className="mt-1 border-t border-line pt-1">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <LayoutGrid size={14} strokeWidth={1.75} />
                All clubs
              </Link>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function ClubMark({ name, small = false }: { name: string; small?: boolean }) {
  const hue = nameHue(name)
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-[30%] font-semibold',
        small ? 'size-6 text-[10px]' : 'size-9 text-xs'
      )}
      style={{ background: `oklch(0.32 0.05 ${hue})`, color: `oklch(0.92 0.05 ${hue})` }}
    >
      {initials(name)}
    </span>
  )
}
