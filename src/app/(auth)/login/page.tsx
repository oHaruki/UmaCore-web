'use client'

import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        .fade-up { opacity: 0; animation: fadeUp 200ms ease forwards; }
        .d1 { animation-delay: 40ms; }
        .d2 { animation-delay: 100ms; }
        .d3 { animation-delay: 160ms; }
        .d4 { animation-delay: 220ms; }
        .d5 { animation-delay: 280ms; }
      `}</style>

      <div className="min-h-screen bg-[#0a0a0f] flex">

        {/* Left panel — fixed width, slight surface bg */}
        <div className="w-[400px] shrink-0 flex flex-col px-10 py-12 bg-[#0d0d14] border-r border-white/5">

          {/* Main content — grows to fill space, pushing footer down */}
          <div className="flex-1 flex flex-col justify-center gap-10">

            {/* Brand */}
            <div className="fade-up d1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0"
                style={{ animation: 'pulse 2.4s ease-in-out infinite' }} />
              <span className="text-white text-sm font-semibold tracking-tight">UmaCore</span>
            </div>

            {/* Login block */}
            <div className="fade-up d2 space-y-5">
              <div>
                <h1 className="text-2xl font-semibold text-white leading-snug">Welcome back</h1>
                <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed">
                  Sign in to manage your club quota, members, and reports.
                </p>
              </div>

              <button
                onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
                className="w-full flex items-center justify-center gap-2.5 bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-medium py-2.5 rounded-lg transition-colors duration-150"
              >
                <DiscordIcon />
                Continue with Discord
              </button>

              <p className="text-xs text-zinc-600">
                Only club administrators can sign in.
              </p>
            </div>

            {/* Divider */}
            <div className="fade-up d3 h-px bg-white/5" />

            {/* Feature list */}
            <div className="fade-up d4 space-y-3">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">What you get</p>
              {[
                ['Quota tracking', 'Daily and monthly across all clubs'],
                ['Member management', 'Active, inactive, and history'],
                ['No Discord needed', 'Everything in one dashboard'],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="mt-1.5 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                  <div>
                    <p className="text-xs text-zinc-300 font-medium">{title}</p>
                    <p className="text-xs text-zinc-600">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Footer links — pinned to bottom */}
          <div className="fade-up d5 flex items-center gap-4 pt-8 border-t border-white/5">
            <a href="https://discord.gg/f4QZNag9Hv" target="_blank" rel="noopener noreferrer"
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              Support
            </a>
            <span className="text-zinc-800">·</span>
            <a href="https://github.com/oHaruki/UmaCore" target="_blank" rel="noopener noreferrer"
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              Docs
            </a>
            <span className="text-zinc-800">·</span>
            <a href="https://ko-fi.com/harukidev" target="_blank" rel="noopener noreferrer"
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              Ko-fi
            </a>
            <span className="flex-1" />
            <p className="text-xs text-zinc-700">© 2026 UmaCore</p>
          </div>
        </div>

        {/* Right — character + floating UI previews */}
        <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: '#0c0a12' }}>

          {/* Left-edge blend */}
          <div className="absolute left-0 top-0 bottom-0 w-16 z-20 pointer-events-none bg-gradient-to-r from-[#0d0d14] to-transparent" />

          {/* GIF */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/UmaViewer_2026-04-26_17-51-01-477.gif"
            alt="Sakura Chiyono"
            className="fade-up d3 absolute inset-0"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }}
          />

          {/* Floating preview cards — fill the transparent space */}

          {/* Top-right: active clubs */}
          <div className="fade-up d2 absolute top-8 right-8 z-30 bg-[#111116] border border-white/8 rounded-lg px-3.5 py-3 min-w-[160px]">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Active clubs</p>
            <p className="mt-1 text-lg font-semibold text-white">3</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">across all servers</p>
          </div>

          {/* Right-center: quota status */}
          <div className="fade-up d3 absolute top-1/2 right-8 z-30 -translate-y-1/2 bg-[#111116] border border-white/8 rounded-lg px-3.5 py-3 min-w-[180px]">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Today's quota</p>
            <div className="mt-2 space-y-1.5">
              {[
                { label: 'On track', count: '18', color: 'bg-emerald-500' },
                { label: 'Behind',   count: '4',  color: 'bg-amber-500' },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                    <span className="text-xs text-zinc-400">{label}</span>
                  </div>
                  <span className="text-xs font-medium text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom-right: last updated */}
          <div className="fade-up d4 absolute bottom-10 right-8 z-30 bg-[#111116] border border-white/8 rounded-lg px-3.5 py-3 min-w-[160px]">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Members</p>
            <p className="mt-1 text-lg font-semibold text-white">22</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">active this period</p>
          </div>

          {/* Top-left (above character head area): subtle name label */}
          <div className="fade-up d2 absolute top-8 left-20 z-30">
            <p className="text-[11px] text-zinc-600 font-medium">Sakura Chiyono</p>
            <p className="text-[10px] text-zinc-700">Uma Musume</p>
          </div>

          {/* Speech bubble — character attribution */}
          <div className="fade-up d5 absolute z-30" style={{ top: '32%', left: '8%' }}>
            <div className="relative">
              <a
                href="https://uma.moe"
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-[#111116] border border-white/10 rounded-2xl px-4 py-3 max-w-[190px] hover:border-white/20 transition-colors"
              >
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Thanks to{' '}
                  <span className="text-violet-400 font-medium">uma.moe</span>
                  {' '}for providing their API! 🐴
                </p>
              </a>
              {/* Connector line — starts at bubble right edge, goes toward character */}
              <div className="absolute" style={{
                top: '50%',
                left: '100%',
                width: '160px',
                height: '1px',
                background: 'linear-gradient(to right, rgba(255,255,255,0.15), rgba(255,255,255,0.02))',
                transform: 'translateY(-50%) rotate(-12deg)',
                transformOrigin: 'left center',
              }} />
              {/* Dot at far end — offset accounts for -12deg rotation over 160px */}
              <div className="absolute rounded-full" style={{
                top: 'calc(50% - 35px)',
                left: 'calc(100% + 154px)',
                width: '4px',
                height: '4px',
                background: 'rgba(255,255,255,0.12)',
              }} />
            </div>
          </div>

        </div>

      </div>
    </>
  )
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.033.05a19.902 19.902 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 13.96 13.96 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}
