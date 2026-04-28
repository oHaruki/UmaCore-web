import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{
          color: '#ffffff',
          fontSize: 36,
          fontWeight: 700,
          fontFamily: 'sans-serif',
          letterSpacing: '-1px',
          lineHeight: 1,
        }}>
          U
        </span>
      </div>
    ),
    { ...size }
  )
}
