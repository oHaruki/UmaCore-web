import Link from 'next/link'
import Image from 'next/image'

export default function AllianceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] bg-canvas font-ui text-fg antialiased">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="relative size-7 overflow-hidden rounded-[30%] bg-brand/15 ring-1 ring-brand/25">
              <Image src="/images/sakura_face.webp" alt="" fill sizes="28px" className="object-cover" />
            </span>
            <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">UmaCore</span>
            <span className="hidden text-[13px] text-fg-subtle sm:inline">Alliance</span>
          </Link>
          <Link href="/recruiting" className="btn btn-ghost btn-sm ml-auto">Recruiting</Link>
        </div>
      </header>
      <main className="relative mx-auto w-full max-w-[1100px] px-4 pt-8 pb-20 md:px-8 md:pt-10">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-xs text-fg-subtle md:px-8">
          <span>Fans update with each club&apos;s daily check.</span>
          <span className="flex-1" />
          <Link href="/privacy" className="hover:text-fg-muted">Privacy</Link>
        </div>
      </footer>
    </div>
  )
}
