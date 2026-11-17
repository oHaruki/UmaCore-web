import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { ArrowLeft, BadgeCheck } from 'lucide-react'
import { getPlayerPost, UUID_RE } from '@/lib/recruiting'
import { formatFans, timeAgo } from '@/lib/format'
import { formatTrainerId, playerPostPath } from '@/lib/recruiting-shared'
import { Stat, StatStrip } from '@/components/dash/ui'
import { GradeBadge, PlayerAvatar, Tags } from '@/components/recruiting/cards'
import CopyButton from '@/components/recruiting/CopyButton'
import { DiscordIcon } from '@/components/recruiting/DiscordIcon'

type Props = { params: Promise<{ id: string }> }

async function load(id: string) {
  return getPlayerPost(id).catch(() => null)
}

const rank = (n: number | null | undefined) => (n ? `#${n.toLocaleString('en-US')}` : '-')

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).id)
  if (!p) return { title: 'Recruiting' }
  const title = `${p.trainer_name} is looking for a club`
  const description = [
    p.min_grade && `Wants ${p.min_grade} or better`,
    p.stats?.daily_avg && `${formatFans(p.stats.daily_avg)} fans/day`,
    p.description.slice(0, 120),
  ].filter(Boolean).join(', ')
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary', title, description } }
}

export default async function PlayerListingPage({ params }: Props) {
  const { id } = await params
  const p = await load(id)
  if (!p) notFound()
  // old uuid links move to the trainer ID
  if (UUID_RE.test(id)) permanentRedirect(playerPostPath(p))
  const s = p.stats

  return (
    <div className="space-y-6">
      <Link href="/recruiting?tab=players" className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted transition-colors hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.75} /> All trainers
      </Link>

      <section className="panel flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <PlayerAvatar player={p} size={68} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] md:text-[30px]">{p.trainer_name}</h1>
              {p.linked && (
                <span title="Trainer linked to this Discord account through UmaCore" className="text-brand">
                  <BadgeCheck size={20} strokeWidth={2} />
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {p.discord_name} on Discord, {s?.circle_name ? <>currently in {s.circle_name}</> : 'not in a club'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href={`https://discord.com/users/${p.discord_user_id}`} target="_blank" rel="noopener noreferrer" className="btn bg-[#5865F2] text-white hover:bg-[#4752c4]">
            <DiscordIcon /> Message on Discord
          </a>
          <CopyButton value={p.trainer_id} label={`ID ${formatTrainerId(p.trainer_id)}`} />
        </div>
      </section>

      {!p.is_open && (
        <div className="panel-inset px-4 py-3 text-[13px] text-fg-muted">This trainer has found a club or closed the post.</div>
      )}

      <StatStrip>
        <Stat label="Avg per day" value={s?.daily_avg ? formatFans(s.daily_avg) : '-'} hint="over the last 30 days" />
        <Stat label="Fan rank" value={rank(s?.monthly_fan_rank)} hint="this month, all trainers" />
        <Stat label="Team class" value={s?.team_class ?? '-'} hint={s?.team_rating ? `${s.team_rating.toLocaleString('en-US')} rating` : 'Team Trials'} />
        <Stat label="All-time fans" value={s?.alltime_fans ? formatFans(s.alltime_fans) : '-'} hint={s?.alltime_rank ? `rank ${rank(s.alltime_rank)}` : undefined} />
      </StatStrip>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="panel p-5 md:p-6 lg:self-start">
          <h2 className="text-[15px] font-semibold">About</h2>
          {p.description ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg-soft">{p.description}</p>
          ) : (
            <p className="mt-3 text-sm text-fg-subtle">No description.</p>
          )}
          {p.tags.length > 0 && <div className="mt-5"><Tags tags={p.tags} /></div>}
        </section>
        <aside className="space-y-4">
          <section className="panel p-5">
            <h2 className="text-[15px] font-semibold">Looking for</h2>
            <dl className="mt-3 divide-y divide-line text-[13px]">
              <Row label="Club grade">{p.min_grade ? <GradeBadge grade={p.min_grade} suffix=" or better" /> : 'Any'}</Row>
              {p.daily_fans ? <Row label="Can do">{formatFans(p.daily_fans)} fans a day</Row> : null}
              {p.language && <Row label="Language">{p.language}</Row>}
            </dl>
          </section>
          <div className="space-y-1 px-1 text-xs text-fg-subtle">
            {p.stats_updated_at && <p>Stats from uma.moe, updated {timeAgo(p.stats_updated_at)}</p>}
            <p>Posted {timeAgo(p.bumped_at)}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right text-fg-soft">{children}</dd>
    </div>
  )
}
