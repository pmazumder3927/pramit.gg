import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const hasTitle = searchParams.has('title')
    const title = hasTitle
      ? searchParams.get('title')?.slice(0, 100)
      : 'pramit.gg'
    
    const hasDescription = searchParams.has('description')
    const description = hasDescription
      ? searchParams.get('description')?.slice(0, 200)
      : 'a living, evolving journal of interests, projects, and experiences'
    
    const type = searchParams.get('type') || 'note'
    
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            backgroundImage: 'linear-gradient(to bottom right, #0a0a0a, #1a1a1a, #0a0a0a)',
            padding: '80px',
          }}
        >
          {/* Gradient overlays */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(120,119,198,0.1), transparent 50%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'radial-gradient(circle at 80% 70%, rgba(255,107,61,0.08), transparent 50%)',
            }}
          />
          
          {/* Type badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '30px',
            }}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: 300,
                color: type === 'music' ? '#ff6b3d' : type === 'climb' ? '#7877c6' : '#e0e0e0',
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              {type}
            </div>
          </div>
          
          {/* Title */}
          <div
            style={{
              fontSize: '64px',
              fontWeight: 200,
              color: '#ffffff',
              marginBottom: '30px',
              lineHeight: 1.2,
              maxWidth: '90%',
            }}
          >
            {title}
          </div>
          
          {/* Description */}
          {description && (
            <div
              style={{
                fontSize: '28px',
                fontWeight: 300,
                color: '#b0b0b0',
                lineHeight: 1.5,
                maxWidth: '80%',
                marginBottom: '40px',
              }}
            >
              {description}
            </div>
          )}
          
          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: '80px',
              left: '80px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            <div
              style={{
                fontSize: '32px',
                fontWeight: 300,
                color: '#ffffff',
              }}
            >
              pramit.gg
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (e: any) {
    console.log(`${e.message}`)
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}