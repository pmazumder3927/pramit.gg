# pramit.gg Project Context

## Project Overview
This is a personal website built with Next.js 15, TypeScript, and Tailwind CSS. It features blog posts, music integration with Spotify, and social connections.

## Tech Stack
- **Framework**: Next.js 15.4.1 with App Router
- **Language**: TypeScript 5.3.3
- **Styling**: Tailwind CSS 3.4.0
- **Database**: Supabase
- **UI Libraries**: 
  - Motion (12.23.5) for animations
  - React Markdown (9.0.1) for blog content
  - React Player (2.13.0) for media playback

## Project Structure
- `/app` - Next.js app directory with pages and API routes
- `/app/components` - Shared React components
- `/app/api` - API routes for auth, posts, Spotify, and uploads
- `/utils/supabase` - Supabase client utilities
- `/public` - Static assets

## Key Features
1. **Blog System** - Markdown-based posts with view tracking
2. **Music Integration** - Spotify API integration for now playing, playlists, and top tracks
3. **Connect Page** - Social links, QR code generation, and confessional booth
4. **Authentication** - Supabase auth for admin dashboard

## Development Commands
```bash
npm run dev      # Start development server with Turbopack
npm run build    # Build for production
npm run lint     # Run Next.js linter
npm run start    # Start production server
```

## Environment Variables
The project uses Supabase and likely requires:
- Supabase URL and keys
- Spotify API credentials
- Other API keys for integrations

## Code Style
- TypeScript with strict type checking
- Functional React components with hooks
- Tailwind CSS for styling
- Next.js App Router patterns

## Important Files
- `middleware.ts` - Next.js middleware configuration
- `app/layout.tsx` - Root layout with metadata
- `app/lib/supabase.ts` - Database client setup
- `tailwind.config.ts` - Tailwind configuration