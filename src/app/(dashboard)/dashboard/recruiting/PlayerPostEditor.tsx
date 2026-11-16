'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck } from 'lucide-react'
import { Field, Switch } from '@/components/dash/Modal'
import { PlayerRow } from '@/components/recruiting/cards'
import { formatFans } from '@/lib/format'
import {
  GRADES, LIMITS, MAX_LANGUAGES, cleanTrainerId, formatTrainerId, parseFans, parseLanguages, type PlayerListing, type TrainerStats,
} from '@/lib/recruiting-shared'
import { CharCount, ListingStatus, PostActions, LanguagePicker, TagPicker } from './widgets'

type Me = { discordId: string; name: string; image: string | null }
type Linked = { trainer_id: string; trainer_name: string } | null

export default function PlayerPostEditor({ post, linked, me }: { post: PlayerListing | null; linked: Linked; me: Me }) {
  const router = useRouter()
  const [trainerId, setTrainerId] = useState(post?.trainer_id ?? linked?.trainer_id ?? '')
  const [minGrade, setMinGrade] = useState(post?.min_grade ?? '')
  const [dailyFans, setDailyFans] = useState(post?.daily_fans ? formatFans(post.daily_fans) : '')
  const [description, setDescription] = useState(post?.description ?? '')
  const [langs, setLangs] = useState(() => parseLanguages(post?.language))
  const [tags, setTags] = useState(post?.tags ?? [])
  const [isOpen, setIsOpen] = useState(post?.is_open ?? true)
  const [checked, setChecked] = useState<TrainerStats | null>(post?.stats ?? null)
  const [checking, setChecking] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const cleanId = cleanTrainerId(trainerId)
  const stats = checked && cleanId === checked.trainer_id ? checked : null
  const parsedFans = parseFans(dailyFans)

  async function check() {
    if (!cleanId) return setErrors(e => ({ ...e, trainerId: 'Your trainer ID is the 9 to 12 digit number on your in-game profile' }))
    setChecking(true)
    setErrors(e => ({ ...e, trainerId: '' }))
    try {
      const res = await fetch(`/api/recruiting/trainer?id=${cleanId}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setErrors(e => ({ ...e, trainerId: j.error ?? 'Could not check that ID' }))
      else setChecked(j.trainer)
    } finally {
      setChecking(false)
    }
  }

  function collect() {
    const e: Record<string, string> = {}
    if (!cleanId) e.trainerId = 'Your trainer ID is the 9 to 12 digit number on your in-game profile'
    if (description.length > LIMITS.playerDescription) e.description = `Keep it under ${LIMITS.playerDescription} characters`
    if (Number.isNaN(parsedFans)) e.dailyFans = 'Use a number like 1.5M or 800K'
    setErrors(e)
    if (Object.keys(e).length) return null
    return {
      trainer_id: cleanId, min_grade: minGrade || null, daily_fans: parsedFans, description,
      language: langs.join(', '), tags, is_open: isOpen,
    }
  }

  const preview: PlayerListing = {
    post_id: post?.post_id ?? 'preview',
    discord_user_id: me.discordId,
    discord_name: me.name,
    discord_avatar: me.image,
    trainer_id: cleanId ?? '',
    trainer_name: stats?.trainer_name ?? post?.trainer_name ?? linked?.trainer_name ?? 'Your trainer',
    min_grade: minGrade || null,
    daily_fans: Number.isNaN(parsedFans) ? null : parsedFans,
    description, language: langs.join(', ') || null, tags,
    stats, stats_updated_at: post?.stats_updated_at ?? null, is_open: isOpen,
    linked: !!linked && linked.trainer_id === cleanId,
    bumped_at: post?.bumped_at ?? new Date().toISOString(),
    updated_at: post?.updated_at ?? new Date().toISOString(),
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="panel space-y-6 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ListingStatus exists={!!post} isOpen={post?.is_open ?? true} bumpedAt={post?.bumped_at ?? null} />
          <label className="flex items-center gap-2.5 text-[13px] text-fg-soft">
            Still looking
            <Switch checked={isOpen} onChange={setIsOpen} label="Still looking" />
          </label>
        </div>

        <Field
          label="Trainer ID"
          htmlFor="rp-id"
          error={errors.trainerId}
          hint={linked && linked.trainer_id === cleanId
            ? <>Your linked trainer <b className="font-medium text-fg-soft">{linked.trainer_name}</b>, shown with a check mark on the board.</>
            : linked
              ? <>Not your linked trainer. <button type="button" className="link" onClick={() => setTrainerId(linked.trainer_id)}>Use {linked.trainer_name}</button></>
              : 'The long number on your in-game profile. Club leaders send the invite to this ID.'}
        >
          <div className="flex gap-2">
            <input
              id="rp-id"
              value={trainerId}
              onChange={e => { setTrainerId(e.target.value); setErrors(x => ({ ...x, trainerId: '' })) }}
              className="field num"
              placeholder="485 643 302 279"
              inputMode="numeric"
            />
            <button type="button" onClick={check} disabled={checking || !cleanId} className="btn btn-secondary shrink-0">
              {checking ? 'Checking…' : 'Check'}
            </button>
          </div>
          {stats && (
            <p className="flex items-center gap-1.5 text-xs text-good">
              <BadgeCheck size={14} strokeWidth={2} />
              {stats.trainer_name}{stats.circle_name ? `, in ${stats.circle_name}` : ', not in a club'} (ID {formatTrainerId(stats.trainer_id)})
            </p>
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Club grade you want" hint="The lowest grade you'd join." htmlFor="rp-grade">
            <select id="rp-grade" value={minGrade} onChange={e => setMinGrade(e.target.value)} className="field">
              <option value="">Any club</option>
              {GRADES.map(g => <option key={g} value={g}>{g} or better</option>)}
            </select>
          </Field>
          <Field label="Fans you can do a day" error={errors.dailyFans} hint="Optional. Your real 30-day average is shown too." htmlFor="rp-fans">
            <input id="rp-fans" value={dailyFans} onChange={e => setDailyFans(e.target.value)} className="field" placeholder="e.g. 1.5M" inputMode="decimal" />
          </Field>
        </div>

        <Field
          label={<span className="flex justify-between">About you <CharCount value={description} max={LIMITS.playerDescription} /></span>}
          hint="When you play, what you're after, anything a leader should know."
          error={errors.description}
          htmlFor="rp-desc"
        >
          <textarea id="rp-desc" rows={5} value={description} onChange={e => setDescription(e.target.value)} className="field resize-y" />
        </Field>
        <Field label="Language" hint={`Pick up to ${MAX_LANGUAGES}.`}>
          <LanguagePicker value={langs} onChange={setLangs} />
        </Field>

        <Field label="Play style">
          <TagPicker value={tags} onChange={setTags} />
        </Field>

        <div className="space-y-3 border-t border-line pt-5">
          <p className="text-xs leading-relaxed text-fg-subtle">
            Your post shows your Discord name and a link to message you, so leaders can reach you.
          </p>
          <PostActions
            url="/api/recruiting/player"
            exists={!!post}
            bumpedAt={post?.bumped_at ?? null}
            saveLabel={post ? 'Save changes' : 'Post LFC'}
            onSave={collect}
            onDone={msg => { setNotice(msg); router.refresh(); setTimeout(() => setNotice(null), 2500) }}
          />
          {notice && <p className="text-xs text-good">{notice}</p>}
        </div>
      </section>

      <aside className="space-y-3 lg:sticky lg:top-8 lg:self-start">
        <p className="text-xs font-medium text-fg-subtle">Preview</p>
        <PlayerRow player={preview} />
        <p className="text-xs leading-relaxed text-fg-subtle">
          Avg per day, fan rank and team class come from uma.moe and refresh once a day.
          {!stats && ' Press Check to load yours.'}
        </p>
      </aside>
    </div>
  )
}
