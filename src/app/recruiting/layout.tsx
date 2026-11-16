import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import SignInToPost from '@/components/recruiting/SignInToPost'
import RecruitSwapIn from '@/components/recruiting/RecruitSwapIn'

export default async function RecruitingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <RecruitSwapIn className="relative min-h-[100dvh] bg-canvas font-ui text-fg antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_70%_0%,rgb(139_92_246/7%),transparent_70%)]"
      />
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 md:px-8">
          <Link href="/recruiting" className="flex items-center gap-2.5">
            <span className="relative size-7 overflow-hidden rounded-[30%] bg-brand/15 ring-1 ring-brand/25">
              <Image src="/images/sakura_face.webp" alt="" fill sizes="28px" className="object-cover" />
            </span>
            <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">UmaCore</span>
            <span className="hidden text-[13px] text-fg-subtle sm:inline">Recruiting</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {session ? (
              <>
                <Link href="/dashboard" className="btn btn-ghost btn-sm hidden sm:inline-flex">Dashboard</Link>
                <Link href="/dashboard/recruiting" className="btn btn-primary btn-sm">Your posts</Link>
              </>
            ) : (
              <SignInToPost label="Sign in" className="btn btn-secondary btn-sm" />
            )}
          </div>
        </div>
      </header>
      <main className="relative mx-auto w-full max-w-[1200px] px-4 pt-8 pb-20 md:px-8 md:pt-10">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-xs text-fg-subtle md:px-8">
          <span>Club stats update with every daily scrape. Player stats come from uma.moe, refreshed daily.</span>
          <span className="flex-1" />
          <Link href="/privacy" className="hover:text-fg-muted">Privacy</Link>
          <a href="https://discord.gg/f4QZNag9Hv" target="_blank" rel="noopener noreferrer" className="hover:text-fg-muted">Support</a>
        </div>
      </footer>
    </RecruitSwapIn>
  )
}
