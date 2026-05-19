'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, ScrollText, Settings, LogOut, Bomb, FileBarChart2, BarChart3, Sparkles, ClipboardList, BookOpen, Menu, X, PlusCircle } from 'lucide-react'
import { signOut } from 'next-auth/react'

const nav = [
  { label: 'Overview',      href: '/dashboard',          icon: LayoutDashboard },
  { label: 'Club Overview', href: '/dashboard/clubs',    icon: BarChart3 },
  { label: 'Members',       href: '/dashboard/members',  icon: Users },
  { label: 'Reports',       href: '/dashboard/reports',  icon: FileBarChart2 },
  { label: 'Quota History', href: '/dashboard/quota',    icon: ScrollText },
  { label: 'Bombs',         href: '/dashboard/bombs',    icon: Bomb },
  { label: 'Settings',      href: '/dashboard/settings', icon: Settings },
  { label: 'Audit Log',     href: '/dashboard/audit-log', icon: ClipboardList },
  { label: 'Guide',         href: '/dashboard/guide',     icon: BookOpen },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#0d0d14] border border-white/5 text-zinc-400 hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'w-56 h-screen bg-[#0d0d14] border-r border-white/5 flex flex-col fixed left-0 top-0 z-50 transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <div className="px-5 py-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <span className="text-white font-bold tracking-tight text-lg">UmaCore</span>
            <p className="text-xs text-zinc-500 mt-0.5">Dashboard</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden p-1 text-zinc-500 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                pathname === href
                  ? 'bg-violet-600/20 text-violet-300'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/5 space-y-0.5">
          <a
            href="https://discord.com/oauth2/authorize?client_id=1467295225184784488&permissions=83968&integration_type=0&scope=bot+applications.commands"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <PlusCircle size={16} />
            Add to server
          </a>
          <Link
            href="/dashboard/changelog"
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              pathname === '/dashboard/changelog'
                ? 'bg-violet-600/20 text-violet-300'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            )}
          >
            <Sparkles size={16} />
            What&apos;s new
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors w-full"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
