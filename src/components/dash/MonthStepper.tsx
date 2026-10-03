import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthLabel } from '@/lib/month'

const step = 'grid size-9 place-items-center rounded-[10px] transition-colors'

/** Prev/next through the months that have data. `months` is newest first. */
export default function MonthStepper({
  month,
  months,
  href,
}: {
  month: string
  months: string[]
  href: (month: string) => string
}) {
  const i = months.indexOf(month)
  const older = i >= 0 ? months[i + 1] : undefined
  const newer = i > 0 ? months[i - 1] : undefined

  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
      {older ? (
        <Link href={href(older)} scroll={false} className={`${step} text-fg-muted hover:bg-surface-2 hover:text-fg`} aria-label={`Show ${monthLabel(older)}`}>
          <ChevronLeft size={16} strokeWidth={1.75} />
        </Link>
      ) : (
        <span className={`${step} text-fg-subtle/40`} aria-hidden><ChevronLeft size={16} strokeWidth={1.75} /></span>
      )}
      <span className="min-w-36 px-2 text-center text-[13px] font-medium text-fg">
        {monthLabel(month)}
        {i === 0 && <span className="ml-1.5 text-xs font-normal text-brand">current</span>}
      </span>
      {newer ? (
        <Link href={href(newer)} scroll={false} className={`${step} text-fg-muted hover:bg-surface-2 hover:text-fg`} aria-label={`Show ${monthLabel(newer)}`}>
          <ChevronRight size={16} strokeWidth={1.75} />
        </Link>
      ) : (
        <span className={`${step} text-fg-subtle/40`} aria-hidden><ChevronRight size={16} strokeWidth={1.75} /></span>
      )}
    </div>
  )
}
