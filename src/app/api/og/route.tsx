import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { origin } = new URL(req.url)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          background: '#0a0a0f',
          fontFamily: 'sans-serif',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Subtle grid lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          display: 'flex',
        }} />

        {/* Violet glow top-left */}
        <div style={{
          position: 'absolute', top: '-120px', left: '-80px',
          width: '500px', height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Horse girl image — right side */}
        <img
          src={`${origin}/images/UmaViewer_2026-04-26_17-29-26-620.png`}
          style={{
            position: 'absolute', right: 0, bottom: 0,
            height: '630px', width: 'auto',
            objectFit: 'cover', objectPosition: 'top',
            maskImage: 'linear-gradient(to left, rgba(0,0,0,0.9) 60%, transparent 100%)',
          }}
        />

        {/* Right fade overlay */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '460px',
          background: 'linear-gradient(to right, #0a0a0f 0%, transparent 100%)',
          display: 'flex',
        }} />

        {/* Left content */}
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 80px',
          width: '660px',
        }}>
          {/* Dot + brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: '#7c3aed',
            }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Uma Musume
            </span>
          </div>

          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '20px' }}>
            <span style={{ color: '#ffffff', fontSize: '80px', fontWeight: 700, lineHeight: 1, letterSpacing: '-2px' }}>
              Uma
            </span>
            <span style={{ color: '#7c3aed', fontSize: '80px', fontWeight: 700, lineHeight: 1, letterSpacing: '-2px' }}>
              Core
            </span>
          </div>

          {/* Description */}
          <p style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: '22px', lineHeight: 1.5,
            margin: 0, marginBottom: '48px',
            maxWidth: '480px',
          }}>
            Quota tracking, member management, and reports — all in one dashboard for Uma Musume club admins.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {['Quota tracking', 'Member management', 'Bomb tracker', 'Reports'].map(f => (
              <div key={f} style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '999px',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '14px',
              }}>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
