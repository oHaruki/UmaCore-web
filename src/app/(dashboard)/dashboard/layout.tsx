import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import MotionProvider from '@/components/layout/MotionProvider'
import Sidebar from '@/components/layout/Sidebar'
import DonationBanner from '@/components/layout/DonationBanner'
import WelcomeModal from '@/components/layout/WelcomeModal'
import { resolveActiveClub } from '@/lib/active-club'
import { queryOne } from '@/lib/db'
import { LATEST_VERSION } from './changelog/data'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { active, clubs } = await resolveActiveClub(session)

  // Sidebar badges: what's waiting on a leader in the active club.
  const counts = active
    ? await queryOne<{ bombs: number; transfers: number }>(`
        SELECT
          (SELECT COUNT(*) FROM bombs WHERE club_id::text = $1 AND is_active)::int AS bombs,
          (SELECT COUNT(*) FROM transfer_requests WHERE to_club_id::text = $1 AND status = 'pending')::int AS transfers
      `, [active.club_id]).catch(() => null)
    : null

  return (
    <MotionProvider>
      <div className="relative min-h-[100dvh] bg-canvas font-ui text-fg antialiased">
        {/* Faint violet glow at the top of every page, as on the login */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_70%_0%,rgb(139_92_246/6%),transparent_70%)]"
        />
        <WelcomeModal />
        <Sidebar
          isOwner={session.isOwner ?? false}
          clubs={clubs.map(c => ({ club_id: c.club_id, club_name: c.club_name, is_active: c.is_active }))}
          activeId={active?.club_id ?? null}
          counts={{ bombs: counts?.bombs ?? 0, transfers: counts?.transfers ?? 0 }}
          user={{ name: session.user?.name ?? null, image: session.user?.image ?? null }}
          latestVersion={LATEST_VERSION}
        />
        <div className="relative md:pl-64">
          <main id="main" className="mx-auto w-full max-w-[1320px] px-4 pt-20 pb-20 md:px-8 md:pt-9">
            <DonationBanner />
            {children}
          </main>
        </div>
      </div>
    </MotionProvider>
  )
}
