import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import DonationBanner from '@/components/layout/DonationBanner'
import WelcomeModal from '@/components/layout/WelcomeModal'
import ClubSwitcher from '@/components/layout/ClubSwitcher'
import { resolveActiveClub } from '@/lib/active-club'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { active, clubs } = await resolveActiveClub(session)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <WelcomeModal />
      <Sidebar isOwner={session.isOwner ?? false} activeClubName={active?.club_name ?? null} />
      <main className="md:ml-56 p-4 pt-16 md:p-8 md:pt-8">
        {clubs.length > 0 && (
          <div className="flex justify-end mb-4">
            <ClubSwitcher clubs={clubs} activeId={active?.club_id ?? null} />
          </div>
        )}
        <DonationBanner />
        {children}
      </main>
    </div>
  )
}
