import { readFile } from 'fs/promises'
import path from 'path'
import { ImageResponse } from 'next/og'
import { getAllianceBySlug } from '@/lib/alliance'
import { listAllianceClubs } from '@/lib/recruiting'
import { CLUB_SLOTS, allianceSlots } from '@/lib/recruiting-shared'
import { formatFans } from '@/lib/format'

export const alt = 'UmaCore alliance'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// fans move once a day, no need to hit the db on every crawl
export const revalidate = 600

const SHOWN = 5
const BG = '#0a0a0f'
const MASCOT = 'public/images/UmaViewer_2026-04-26_17-29-26-620.png'

async function mascot() {
  try {
    const buf = await readFile(path.join(process.cwd(), MASCOT))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const alliance = await getAllianceBySlug(slug).catch(() => null)
  const clubs = alliance?.is_public ? await listAllianceClubs(alliance.alliance_id).catch(() => []) : []
  const { rows, openSlots, openClubs } = allianceSlots(clubs)
  const shown = rows.slice(0, SHOWN)
  const title = alliance?.is_public ? alliance.name : 'UmaCore'
  // long names shrink to fit the left column instead of cutting off
  const titleSize = Math.max(34, Math.min(66, Math.floor(670 / (title.length * 0.7))))
  const art = await mascot()

  const num = { display: 'flex', justifyContent: 'flex-end' } as const

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px', height: '630px', display: 'flex', background: BG,
          fontFamily: 'sans-serif', position: 'relative', overflow: 'hidden',
        }}
      >
        {art && (
          <img
            src={art}
            width={1351}
            height={760}
            style={{ position: 'absolute', left: '300px', top: '-6px', width: '1351px', height: '760px' }}
          />
        )}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '860px', display: 'flex',
          background: `linear-gradient(to right, ${BG} 0%, ${BG} 68%, rgba(10,10,15,0) 100%)`,
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', width: '740px', padding: '52px 0 0 72px', position: 'relative' }}>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.5)', fontSize: '22px' }}>
            UmaCore alliance, recruiting
          </div>

          <div style={{
            display: 'flex', marginTop: '14px', color: '#ffffff', fontSize: `${titleSize}px`,
            lineHeight: 1.1, letterSpacing: '-2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </div>

          {rows.length > 0 && (
            <div style={{ display: 'flex', marginTop: '10px', color: openSlots > 0 ? '#4ade80' : 'rgba(255,255,255,0.5)', fontSize: '28px' }}>
              {openSlots > 0
                ? `${openSlots} open slot${openSlots === 1 ? '' : 's'} across ${openClubs} club${openClubs === 1 ? '' : 's'}`
                : 'All clubs are full right now'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '34px' }}>
            {shown.map(({ club: c, perDay, open, recruiting }, i) => (
              <div
                key={c.club_id}
                style={{
                  display: 'flex', alignItems: 'center', height: '58px', fontSize: '26px',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.09)',
                }}
              >
                <span style={{
                  flex: 1, color: '#ffffff', display: 'flex',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {c.club_name}
                </span>
                <span style={{ ...num, width: '150px', color: 'rgba(255,255,255,0.85)' }}>{`${formatFans(perDay)}/day`}</span>
                <span style={{ ...num, width: '110px', color: 'rgba(255,255,255,0.45)' }}>{`${c.members}/${CLUB_SLOTS}`}</span>
                <span style={{ ...num, width: '110px', color: recruiting ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                  {recruiting ? `${open} open` : open > 0 ? 'closed' : 'full'}
                </span>
              </div>
            ))}
            {rows.length > SHOWN && (
              <div style={{
                display: 'flex', height: '48px', alignItems: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '22px',
                borderTop: '1px solid rgba(255,255,255,0.09)',
              }}>
                {`and ${rows.length - SHOWN} more`}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
