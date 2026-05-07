import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import DonationBanner from '@/components/layout/DonationBanner'
import VerificationBanner from '@/components/layout/VerificationBanner'
import WelcomeModal from '@/components/layout/WelcomeModal'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <WelcomeModal />
      <Sidebar />
      <main className="md:ml-56 p-4 pt-16 md:p-8 md:pt-8">
        <VerificationBanner />
        <DonationBanner />
        {children}
      </main>
    </div>
  )
}
