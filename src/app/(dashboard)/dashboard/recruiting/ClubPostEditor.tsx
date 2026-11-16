'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Field, Switch } from '@/components/dash/Modal'
import { ClubRow } from '@/components/recruiting/cards'
import {
  ACCENTS, LIMITS, MAX_LANGUAGES, normalizeInvite, parseFans, parseLanguages, periodWord, type ClubListing,
} from '@/lib/recruiting-shared'
import { formatFans } from '@/lib/format'
import { CharCount, ListingStatus, PostActions, LanguagePicker, TagPicker } from './widgets'

/** Shrinks artwork in the browser so it fits under the upload cap: max 1600px wide, WebP. */
async function toWebp(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / bmp.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  for (const q of [0.88, 0.8, 0.7, 0.6, 0.5]) {
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', q))
    if (blob && blob.size <= LIMITS.imageBytes) return blob
  }
  throw new Error('That image is too detailed to fit, try a smaller one')
}

export default function ClubPostEditor({ club, exists }: { club: ClubListing; exists: boolean }) {
  const router = useRouter()
  const [headline, setHeadline] = useState(club.headline)
  const [description, setDescription] = useState(club.description)
  const [invite, setInvite] = useState(club.discord_invite ?? '')
  const [discordRequired, setDiscordRequired] = useState(club.discord_required)
  const [minDaily, setMinDaily] = useState(club.min_daily_fans ? formatFans(club.min_daily_fans) : '')
  const [langs, setLangs] = useState(() => parseLanguages(club.language))
  const [tags, setTags] = useState(club.tags)
  const [accent, setAccent] = useState(club.accent)
  const [banner, setBanner] = useState(club.banner_image_id)
  const [isOpen, setIsOpen] = useState(club.is_open)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsedMin = parseFans(minDaily)
  const preview: ClubListing = {
    ...club, headline, description, discord_invite: normalizeInvite(invite), discord_required: discordRequired,
    min_daily_fans: Number.isNaN(parsedMin) ? null : parsedMin,
    language: langs.join(', ') || null, tags, accent, banner_image_id: banner, is_open: isOpen,
  }

  async function upload(file: File) {
    setUploading(true)
    setErrors(e => ({ ...e, banner: '' }))
    try {
      const blob = await toWebp(file)
      const fd = new FormData()
      fd.append('file', blob, 'banner.webp')
      const res = await fetch('/api/recruiting/images', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Upload failed')
      setBanner(j.image_id)
    } catch (e) {
      setErrors(x => ({ ...x, banner: e instanceof Error ? e.message : 'Upload failed' }))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function collect() {
    const e: Record<string, string> = {}
    if (!headline.trim()) e.headline = 'Add a headline'
    if (headline.length > LIMITS.headline) e.headline = `Keep it under ${LIMITS.headline} characters`
    if (description.length > LIMITS.clubDescription) e.description = `Keep it under ${LIMITS.clubDescription} characters`
    if (invite.trim() && !normalizeInvite(invite)) e.invite = 'Paste an invite link like discord.gg/abc123'
    if (discordRequired && !invite.trim()) e.invite = 'Add an invite if Discord is required'
    if (Number.isNaN(parsedMin)) e.minDaily = 'Use a number like 1.5M or 800K'
    setErrors(e)
    if (Object.keys(e).length) return null
    return {
      headline, description, discord_invite: invite.trim() || null, discord_required: discordRequired,
      min_daily_fans: parsedMin, language: langs.join(', '), tags, accent, banner_image_id: banner, is_open: isOpen,
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="panel space-y-6 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ListingStatus exists={exists} isOpen={club.is_open} bumpedAt={exists ? club.bumped_at : null} />
          <label className="flex items-center gap-2.5 text-[13px] text-fg-soft">
            Taking new members
            <Switch checked={isOpen} onChange={setIsOpen} label="Taking new members" />
          </label>
        </div>

        <Field label={<span className="flex justify-between">Headline <CharCount value={headline} max={LIMITS.headline} /></span>} error={errors.headline} htmlFor="rc-headline">
          <input id="rc-headline" value={headline} onChange={e => setHeadline(e.target.value)} className="field" placeholder="Chill A+ club, 1M/day, EU evenings" />
        </Field>

        <Field
          label={<span className="flex justify-between">About the club <CharCount value={description} max={LIMITS.clubDescription} /></span>}
          hint="What you play for, how active the chat is, what happens if someone falls behind."
          error={errors.description}
          htmlFor="rc-desc"
        >
          <textarea id="rc-desc" rows={7} value={description} onChange={e => setDescription(e.target.value)} className="field resize-y" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Minimum fans a day"
            hint={`Optional. Your quota is ${formatFans(club.quota)} per ${periodWord(club.quota_period)} and is shown anyway.`}
            error={errors.minDaily}
            htmlFor="rc-min"
          >
            <input id="rc-min" value={minDaily} onChange={e => setMinDaily(e.target.value)} className="field" placeholder="e.g. 1.2M" inputMode="decimal" />
          </Field>
          <Field label="Discord invite" error={errors.invite} hint="Shown as a Join button." htmlFor="rc-invite">
            <input id="rc-invite" value={invite} onChange={e => setInvite(e.target.value)} className="field" placeholder="discord.gg/…" />
          </Field>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-[10px] border border-line bg-surface-2/50 px-4 py-3">
          <span>
            <span className="block text-[13px] font-medium text-fg-soft">Discord is required</span>
            <span className="block text-xs text-fg-subtle">Members have to join your server to be in the club.</span>
          </span>
          <Switch checked={discordRequired} onChange={setDiscordRequired} label="Discord is required" />
        </label>
        <Field label="Language" hint={`Pick up to ${MAX_LANGUAGES}.`}>
          <LanguagePicker value={langs} onChange={setLangs} />
        </Field>

        <Field label="Play style">
          <TagPicker value={tags} onChange={setTags} />
        </Field>

        <Field label="Banner artwork" hint="Wide images work best (about 3:1). PNG, JPEG or WebP, resized for you." error={errors.banner}>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn btn-secondary btn-sm">
              <ImagePlus size={15} strokeWidth={1.75} /> {uploading ? 'Uploading…' : banner ? 'Replace' : 'Upload'}
            </button>
            {banner && (
              <button type="button" onClick={() => setBanner(null)} className="btn btn-ghost btn-sm">
                <Trash2 size={14} strokeWidth={1.75} /> Remove
              </button>
            )}
          </div>
        </Field>

        <Field label="Accent colour" hint="Used for the card glow and your club's initials when there's no banner.">
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map(c => (
              <button
                key={c}
                type="button"
                aria-label={`Accent ${c}`}
                aria-pressed={accent === c}
                onClick={() => setAccent(accent === c ? null : c)}
                className={cn('size-7 rounded-full ring-offset-2 ring-offset-surface transition', accent === c ? 'ring-2 ring-fg' : 'hover:scale-110')}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>

        <div className="border-t border-line pt-5">
          <PostActions
            url={`/api/recruiting/clubs/${club.club_id}`}
            exists={exists}
            bumpedAt={exists ? club.bumped_at : null}
            saveLabel={exists ? 'Save changes' : 'Post listing'}
            onSave={collect}
            onDone={msg => { setNotice(msg); router.refresh(); setTimeout(() => setNotice(null), 2500) }}
          />
          {notice && <p className="mt-2 text-xs text-good">{notice}</p>}
        </div>
      </section>

      <aside className="space-y-3 lg:sticky lg:top-8 lg:self-start">
        <p className="text-xs font-medium text-fg-subtle">Preview</p>
        <ClubRow club={preview} />
        <p className="text-xs leading-relaxed text-fg-subtle">
          Rank, members, quota and average fans come from your club&apos;s daily scrape and update by themselves.
        </p>
      </aside>
    </div>
  )
}
