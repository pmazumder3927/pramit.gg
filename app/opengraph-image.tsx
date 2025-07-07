import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Pramit Mazumder - pramit.gg'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 200,
            letterSpacing: '-0.05em',
            marginBottom: 20,
            background: 'linear-gradient(90deg, #FFFFFF 0%, #E5E5E5 50%, #CCCCCC 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Pramit Mazumder
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 300,
            color: '#999999',
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          a living, evolving journal of interests, projects, and experiences
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 400,
            color: '#666666',
            marginTop: 40,
          }}
        >
          pramit.gg
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}