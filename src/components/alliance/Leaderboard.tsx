import Link from 'next/link'
import { Trophy } from 'lucide-react'
import type { Standings } from '@/lib/alliance'
import { formatDay, formatFans } from '@/lib/format'
import { monthLabel } from '@/lib/month'
import { Avatar, EmptyState, Panel, Stat, StatStrip } from '@/components/dash/ui'
import { cn } from '@/lib/utils'

/** Small coloured dot so each club is easy to pick out in the trainer list. */
function ClubDot({ hue }: { hue: number }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: `oklch(0.72 0.13 ${hue})` }}
    />
  )
}

function Place({ n }: { n: number }) {
  return (
    <span
      className={cn(
        'num inline-block w-6 text-xs',
        n === 1 ? 'font-semibold text-yellow-400' : n === 2 ? 'font-semibold text-slate-300' : n === 3 ? 'font-semibold text-amber-600' : 'text-fg-subtle'
      )}
    >
      {n}
    </span>
  )
}

const gainText = (n: number | null) => (n ? `+${formatFans(n)}` : '-')

export default function Leaderboard({
  standings,
  linkClubs = false,
}: {
  standings: Standings
  /** Link club names to their public club page, when the club has one. */
  linkClubs?: boolean
}) {
  const { clubs, trainers, month, latestDate } = standings
  const totalFans = clubs.reduce((s, c) => s + c.fans, 0)
  const todayGain = clubs.reduce((s, c) => s + c.day_gain, 0)
  const multi = clubs.length > 1
  // spread evenly round the wheel by join order, so sister clubs with similar names still differ
  const hues = new Map(
    [...clubs].sort((a, b) => a.joined_at.localeCompare(b.joined_at))
      .map((c, i) => [c.club_id, (250 + (i * 360) / clubs.length) % 360])
  )

  if (!month) {
    return (
      <div className="panel">
        <EmptyState
          icon={Trophy}
          title="No standings yet"
          body="The leaderboard fills in after the clubs' next daily check."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <StatStrip>
        <Stat label="Clubs" value={clubs.length} />
        <Stat label="Trainers" value={trainers.length} />
        <Stat label={`Fans in ${monthLabel(month, { month: 'long' })}`} value={formatFans(totalFans)} />
        <Stat
          label="Latest day"
          value={todayGain ? `+${formatFans(todayGain)}` : '-'}
          tone={todayGain ? 'good' : 'neutral'}
          hint={latestDate ? formatDay(latestDate) : undefined}
        />
      </StatStrip>

      <Panel title="Clubs" description={`Ranked by fans in ${monthLabel(month)}`} flush>
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead>
              <tr>
                <th className="w-px">#</th>
                <th>Club</th>
                <th className="text-right">Fans</th>
                <th className="hidden text-right sm:table-cell">Per trainer</th>
                <th className="text-right">Latest day</th>
                <th className="hidden text-right md:table-cell">Trainers</th>
                <th className="hidden text-right md:table-cell">Club rank</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((c, i) => (
                <tr key={c.club_id}>
                  <td><Place n={i + 1} /></td>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <ClubDot hue={hues.get(c.club_id) ?? 250} />
                      {linkClubs && c.public_slug ? (
                        <Link href={`/club/${c.public_slug}`} className="font-medium text-fg-soft hover:text-fg">{c.club_name}</Link>
                      ) : (
                        <span className="font-medium text-fg-soft">{c.club_name}</span>
                      )}
                    </span>
                  </td>
                  <td className="num text-right font-medium text-fg">{formatFans(c.fans)}</td>
                  <td className="num hidden text-right text-fg-muted sm:table-cell">{c.members ? formatFans(c.avg) : '-'}</td>
                  <td className={cn('num text-right', c.day_gain ? 'text-good' : 'text-fg-subtle')}>{gainText(c.day_gain)}</td>
                  <td className="num hidden text-right text-fg-muted md:table-cell">{c.members}</td>
                  <td className="num hidden text-right text-fg-muted md:table-cell">{c.club_rank ? `#${c.club_rank.toLocaleString('en-US')}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Trainers" description={multi ? 'Everyone in the alliance on one board' : undefined} flush>
        {trainers.length ? (
          <div className="overflow-x-auto">
            <table className="table-ui">
              <thead>
                <tr>
                  <th className="w-px">#</th>
                  <th>Trainer</th>
                  {multi && <th className="hidden sm:table-cell">Club</th>}
                  <th className="text-right">Fans</th>
                  <th className="text-right">Latest day</th>
                </tr>
              </thead>
              <tbody>
                {trainers.map((t, i) => (
                  <tr key={t.member_id}>
                    <td><Place n={i + 1} /></td>
                    <td>
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar name={t.trainer_name} size={28} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg-soft">{t.trainer_name}</span>
                          {multi && (
                            <span className="flex items-center gap-1.5 text-xs text-fg-subtle sm:hidden">
                              <ClubDot hue={hues.get(t.club_id) ?? 250} />{t.club_name}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    {multi && (
                      <td className="hidden sm:table-cell">
                        <span className="flex items-center gap-2 text-fg-muted">
                          <ClubDot hue={hues.get(t.club_id) ?? 250} />
                          <span className="truncate">{t.club_name}</span>
                        </span>
                      </td>
                    )}
                    <td className="num text-right font-medium text-fg">{formatFans(t.fans)}</td>
                    <td className={cn('num text-right', t.day_gain ? 'text-good' : 'text-fg-subtle')}>{gainText(t.day_gain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No trainers yet" body="Members show up after their club's next daily check." className="border-t border-line" />
        )}
      </Panel>
    </div>
  )
}
