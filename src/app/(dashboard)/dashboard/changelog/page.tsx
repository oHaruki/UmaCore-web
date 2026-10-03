import { CHANGELOG } from './data'
import { PageHeader, Chip } from '@/components/dash/ui'

const tone = { feat: 'brand', fix: 'warn', improve: 'info' } as const
const label = { feat: 'New', fix: 'Fix', improve: 'Improved' } as const

export default function ChangelogPage() {
  return (
    <div className="rise max-w-3xl space-y-8">
      <PageHeader title="What's new" description="Recent changes to UmaCore." />

      <ol className="relative space-y-8 border-l border-line pl-6 md:pl-8">
        {CHANGELOG.map(release => (
          <li key={release.version} className="relative">
            <span
              className={`absolute top-1.5 -left-[29px] size-2.5 rounded-full ring-4 ring-canvas md:-left-[37px] ${
                release.isNew ? 'bg-brand-solid' : 'bg-surface-3'
              }`}
              aria-hidden
            />
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-fg">v{release.version}</h2>
              <span className="text-[13px] text-fg-subtle">{release.date}</span>
              {release.isNew && <Chip tone="brand">Latest</Chip>}
            </div>
            <ul className="panel divide-y divide-line">
              {release.entries.map((e, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                  <Chip tone={tone[e.type]} className="mt-px w-[4.75rem] justify-center">{label[e.type]}</Chip>
                  <p className="text-[13px] leading-relaxed text-fg-soft text-pretty">{e.text}</p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
