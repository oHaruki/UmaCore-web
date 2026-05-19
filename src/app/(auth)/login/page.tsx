import { query } from '@/lib/db'
import LoginButton from './LoginButton'
import CountUp from './CountUp'

type PublicStats = {
  active_clubs: string
  active_members: string
  on_track: string
  behind: string
  total_fans: string
}


// Revalidate every 5 minutes so the numbers stay fresh without hitting the DB on every visit
export const revalidate = 300

export default async function LoginPage() {
  const [stats] = await query<PublicStats>(`
    SELECT
      COUNT(DISTINCT c.club_id) FILTER (WHERE c.is_active)::text AS active_clubs,
      COUNT(DISTINCT m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus IS NOT NULL)::text AS active_members,
      COUNT(DISTINCT m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus >= 0)::text        AS on_track,
      COUNT(DISTINCT m.member_id) FILTER (WHERE m.is_active AND lat.deficit_surplus < 0)::text         AS behind,
      COALESCE(SUM(lat.cumulative_fans) FILTER (WHERE m.is_active), 0)::text                           AS total_fans
    FROM clubs c
    LEFT JOIN members m ON m.club_id = c.club_id
    LEFT JOIN LATERAL (
      SELECT deficit_surplus, cumulative_fans FROM quota_history
      WHERE member_id = m.member_id ORDER BY date DESC LIMIT 1
    ) lat ON true
  `).catch(() => [] as PublicStats[])

  const s = stats ?? { active_clubs: '0', active_members: '0', on_track: '0', behind: '0', total_fans: '0' }

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

        {/* Left panel */}
        <div className="w-full md:w-[400px] shrink-0 flex flex-col px-6 py-10 md:px-10 md:py-12 bg-[#0d0d14] md:border-r border-white/5">
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
              <LoginButton />
              <p className="text-xs text-zinc-600">
                Only club administrators can sign in.
              </p>
            </div>

            {/* Verification approved notice */}
            <div className="fade-up d3 flex items-start gap-2.5 px-3 py-2.5 bg-emerald-500/8 border border-emerald-500/15 rounded-lg">
              <div className="mt-0.5 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
              <p className="text-xs text-zinc-400 leading-relaxed">
                UmaCore is now{' '}
                <span className="text-emerald-400 font-medium">Discord verified.</span>{' '}
                The bot can join new servers again.
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

          {/* Footer */}
          <div className="fade-up d5 flex items-center gap-3 pt-8 border-t border-white/5">
            <a href="https://discord.gg/f4QZNag9Hv" target="_blank" rel="noopener noreferrer"
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors whitespace-nowrap">Support</a>
            <span className="text-zinc-800">·</span>
            <a href="https://github.com/oHaruki/UmaCore" target="_blank" rel="noopener noreferrer"
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors whitespace-nowrap">Docs</a>
            <span className="text-zinc-800">·</span>
            <a href="https://ko-fi.com/harukidev" target="_blank" rel="noopener noreferrer"
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors whitespace-nowrap">Ko-fi</a>
            <span className="text-zinc-800">·</span>
            <a href="/privacy"
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors whitespace-nowrap">Privacy</a>
            <span className="flex-1" />
            <p className="text-xs text-zinc-700 whitespace-nowrap">© 2026 UmaCore</p>
          </div>
        </div>

        {/* Right — character + floating stat cards */}
        <div className="hidden md:flex flex-1 relative overflow-hidden" style={{ backgroundColor: '#0c0a12' }}>

          <div className="absolute left-0 top-0 bottom-0 w-16 z-20 pointer-events-none bg-gradient-to-r from-[#0d0d14] to-transparent" />

          <video
            autoPlay muted loop playsInline
            className="fade-up d3 absolute inset-0"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }}
          >
            <source src="/images/sakura_login.webm" type="video/webm" />
          </video>

          {/* Active clubs */}
          <div className="fade-up d2 absolute top-8 right-8 z-30 bg-[#111116] border border-white/8 rounded-lg px-3.5 py-3 min-w-[160px]">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Active clubs</p>
            <p className="mt-1 text-lg font-semibold text-white">
              <CountUp value={Number(s.active_clubs)} duration={1000} />
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">across all servers</p>
          </div>

          {/* Quota status */}
          <div className="fade-up d3 absolute top-1/2 right-8 z-30 -translate-y-1/2 bg-[#111116] border border-white/8 rounded-lg px-3.5 py-3 min-w-[180px]">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Today&apos;s quota</p>
            <div className="mt-2 space-y-1.5">
              {([
                { label: 'On track', value: Number(s.on_track),  color: 'bg-emerald-500' },
                { label: 'Behind',   value: Number(s.behind),    color: 'bg-amber-500'   },
              ] as const).map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                    <span className="text-xs text-zinc-400">{label}</span>
                  </div>
                  <span className="text-xs font-medium text-white">
                    <CountUp value={value} duration={1400} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Members */}
          <div className="fade-up d4 absolute bottom-10 right-8 z-30 bg-[#111116] border border-white/8 rounded-lg px-3.5 py-3 min-w-[160px]">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Members</p>
            <p className="mt-1 text-lg font-semibold text-white">
              <CountUp value={Number(s.active_members)} duration={1300} />
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">active this period</p>
          </div>

          {/* Total fans — bottom left */}
          <div className="fade-up d4 absolute bottom-10 left-20 z-30 bg-[#111116] border border-white/8 rounded-lg px-3.5 py-3 min-w-[170px]">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Total fans gathered</p>
            <p className="mt-1 text-lg font-semibold text-white">
              <CountUp value={Number(s.total_fans)} duration={1800} formatAs="fans" />
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">across all active members</p>
          </div>

          {/* Character label */}
          <div className="fade-up d2 absolute top-8 left-20 z-30">
            <p className="text-[11px] text-zinc-600 font-medium">Sakura Chiyono O</p>
            <p className="text-[10px] text-zinc-700">Uma Musume</p>
          </div>

          {/* Speech bubble */}
          <div className="fade-up d5 absolute z-30" style={{ top: '32%', left: '8%' }}>
            <div className="relative">
              <a href="https://uma.moe" target="_blank" rel="noopener noreferrer"
                className="block bg-[#111116] border border-white/10 rounded-2xl px-4 py-3 max-w-[190px] hover:border-white/20 transition-colors">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Thanks to{' '}
                  <span className="text-violet-400 font-medium">uma.moe</span>
                  {' '}for providing their API! 🐴
                </p>
              </a>
              <div className="absolute" style={{
                top: '50%', left: '100%', width: '160px', height: '1px',
                background: 'linear-gradient(to right, rgba(255,255,255,0.15), rgba(255,255,255,0.02))',
                transform: 'translateY(-50%) rotate(-12deg)', transformOrigin: 'left center',
              }} />
              <div className="absolute rounded-full" style={{
                top: 'calc(50% - 35px)', left: 'calc(100% + 154px)',
                width: '4px', height: '4px', background: 'rgba(255,255,255,0.12)',
              }} />
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
