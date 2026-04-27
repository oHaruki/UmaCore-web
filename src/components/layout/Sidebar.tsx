'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, ScrollText, Settings, LogOut, Bomb, FileBarChart2 } from 'lucide-react'
import { signOut } from 'next-auth/react'

const nav = [
  { label: 'Overview',      href: '/dashboard',          icon: LayoutDashboard },
  { label: 'Members',       href: '/dashboard/members',  icon: Users },
  { label: 'Reports',       href: '/dashboard/reports',  icon: FileBarChart2 },
  { label: 'Quota History', href: '/dashboard/quota',    icon: ScrollText },
  { label: 'Bombs',         href: '/dashboard/bombs',    icon: Bomb },
  { label: 'Settings',      href: '/dashboard/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 h-screen bg-[#0d0d14] border-r border-white/5 flex flex-col fixed left-0 top-0">
      <div className="px-5 py-6 border-b border-white/5">
        <span className="text-white font-bold tracking-tight text-lg">UmaCore</span>
        <p className="text-xs text-zinc-500 mt-0.5">Dashboard</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
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

      <div className="px-3 py-4 border-t border-white/5">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors w-full"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
