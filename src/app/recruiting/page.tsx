import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Search } from 'lucide-react'
import { auth } from '@/lib/auth'
import { listClubPosts, listPlayerPosts } from '@/lib/recruiting'
import { CLUB_SLOTS, clubDailyAvg, clubPostPath, playerPostPath, gradeForRank, gradeIndex, isGrade, parseLanguages, tagLabel } from '@/lib/recruiting-shared'
import LinkTabs from '@/components/dash/LinkTabs'
import { EmptyState } from '@/components/dash/ui'
import { ClubRow, PlayerRow } from '@/components/recruiting/cards'
import BoardFilters from '@/components/recruiting/BoardFilters'
import SignInToPost from '@/components/recruiting/SignInToPost'

export const metadata: Metadata = {
  title: 'Recruiting',
  description: 'Uma Musume clubs looking for trainers, and trainers looking for a club. Live club stats from UmaCore and player stats from uma.moe.',
  alternates: { canonical: '/recruiting' },
}

type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function RecruitingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const tab = one(sp.tab) === 'players' ? 'players' : 'clubs'
  const q = one(sp.q).toLowerCase()
  const grade = one(sp.grade)
  const lang = one(sp.lang)
  const tag = one(sp.tag)

  const [session, clubsAll, playersAll] = await Promise.all([
    auth(),
    listClubPosts().catch(() => []),
    listPlayerPosts().catch(() => []),
  ])

  // filtering happens here: the board is a few hundred posts at most
  let clubs = clubsAll.filter(c =>
    (!q || c.club_name.toLowerCase().includes(q) || c.headline.toLowerCase().includes(q)) &&
    (!isGrade(grade) || gradeIndex(gradeForRank(c.club_rank)) <= gradeIndex(grade)) &&
    (!lang || parseLanguages(c.language).includes(lang)) &&
    (!tag || c.tags.includes(tag)) &&
    (one(sp.open) !== '1' || c.members < CLUB_SLOTS)
  )
  const sort = one(sp.sort)
  if (sort === 'rank') clubs = [...clubs].sort((a, b) => (a.club_rank ?? 1e9) - (b.club_rank ?? 1e9))
  if (sort === 'avg') clubs = [...clubs].sort((a, b) => (clubDailyAvg(b) ?? 0) - (clubDailyAvg(a) ?? 0))
  if (sort === 'slots') clubs = [...clubs].sort((a, b) => a.members - b.members)

  const minAvg = Number(one(sp.minavg)) || 0
  const players = playersAll.filter(p =>
    (!q || p.trainer_name.toLowerCase().includes(q) || p.discord_name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) &&
    // "would join a club of grade X": their minimum is X or lower
    (!isGrade(grade) || !p.min_grade || gradeIndex(p.min_grade) >= gradeIndex(grade)) &&
    (!lang || parseLanguages(p.language).includes(lang)) &&
    (!tag || p.tags.includes(tag)) &&
    (!minAvg || (p.stats?.daily_avg ?? 0) >= minAvg)
  )

  const filtered = tab === 'clubs' ? clubs.length !== clubsAll.length : players.length !== playersAll.length

  return (
    <div className="space-y-7">
      <header className="space-y-5">
        <div className="max-w-[60ch] space-y-2">
          <h1 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] md:text-[36px]">
            Find a club, or your next trainers
          </h1>
          <p className="text-sm leading-relaxed text-fg-muted text-pretty">
            Clubs list their open spots with live stats. Trainers post what they want, with their uma.moe numbers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {session ? (
            <>
              <Link href="/dashboard/recruiting?tab=club" className="btn btn-secondary">List your club</Link>
              <Link href="/dashboard/recruiting?tab=player" className="btn btn-primary">Post LFC</Link>
            </>
          ) : (
            <SignInToPost label="Post your club or LFC" className="btn btn-primary" />
          )}
        </div>
      </header>

      <div className="space-y-4">
        <LinkTabs
          id="recruiting"
          tabs={[
            { label: 'Clubs recruiting', href: '/recruiting', count: clubsAll.length, current: tab === 'clubs' },
            { label: 'Trainers looking', href: '/recruiting?tab=players', count: playersAll.length, current: tab === 'players' },
          ]}
        />
        <Suspense>
          <BoardFilters key={tab} tab={tab} />
        </Suspense>
        {filtered && (
          <p className="text-xs text-fg-subtle">
            {tab === 'clubs' ? clubs.length : players.length} match{(tab === 'clubs' ? clubs.length : players.length) === 1 ? '' : 'es'}
            {tag ? <> tagged {tagLabel(tag)}</> : null}
          </p>
        )}
      </div>

      {tab === 'clubs' ? (
        clubs.length ? (
          <div className="rise space-y-3">
            {clubs.map(c => <ClubRow key={c.club_id} club={c} href={clubPostPath(c)} />)}
          </div>
        ) : (
          <div className="panel">
            <EmptyState
              icon={Search}
              title={filtered ? 'No clubs match these filters' : 'No clubs are recruiting yet'}
              body={filtered ? 'Try a lower grade or another language.' : 'Club leaders using UmaCore can list their club from the dashboard.'}
            />
          </div>
        )
      ) : players.length ? (
        <div className="rise space-y-3">
          {players.map(p => <PlayerRow key={p.post_id} player={p} href={playerPostPath(p)} />)}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            icon={Search}
            title={filtered ? 'No trainers match these filters' : 'Nobody is looking right now'}
            body={filtered ? 'Try a wider pace or another language.' : 'Looking for a club? Post your trainer ID and what you want.'}
          />
        </div>
      )}
    </div>
  )
}
