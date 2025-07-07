import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title') || 'Pramit Mazumder'
    const subtitle = searchParams.get('subtitle') || 'Software Engineer & Creative Technologist'
    
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0A0A0A',
            backgroundImage: 'linear-gradient(to bottom right, #0A0A0A, #1A1A1A)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 40,
            }}
          >
            <h1
              style={{
                fontSize: 80,
                fontWeight: 300,
                background: 'linear-gradient(to right, #FFFFFF, #E5E5E5, #CCCCCC)',
                backgroundClip: 'text',
                color: 'transparent',
                margin: 0,
                padding: 0,
                textAlign: 'center',
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: 32,
                fontWeight: 300,
                color: '#9CA3AF',
                marginTop: 20,
                textAlign: 'center',
              }}
            >
              {subtitle}
            </p>
          </div>
          
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 300,
                color: '#6B7280',
              }}
            >
              pramit.gg
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (e) {
    return new Response(`Failed to generate image`, {
      status: 500,
    })
  }
}