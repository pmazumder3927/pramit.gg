# pramit.gg

my personal blog/journal/whatever

https://www.pramit.gg/post/why-i-bothered

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Animations**: Framer Motion
- **Backend**: Supabase (Database, Auth, Storage)
- **Media**: React Player (YouTube, SoundCloud embeds), MP4 video uploads
- **Music**: Spotify Web API integration
- **Hosting**: Vercel

## Features

### Content Management
- **Enhanced Markdown Editor**: Rich text editing with drag & drop support
- **Media Uploads**: Upload images and MP4 videos (max 100MB) with automatic insertion at cursor position
- **Math Support**: KaTeX integration for mathematical expressions
- **Code Highlighting**: Syntax highlighting for code blocks

### Media Support
- **Images**: JPG, PNG, GIF, WebP support
- **Videos**: MP4 format with HTML5 video player
- **External Media**: YouTube and SoundCloud embeds
- **Responsive Design**: Mobile-friendly upload interface

## Setup

### Storage Buckets
The application requires one Supabase storage bucket:
- `images` - for all media uploads (images and videos, max 100MB per file)

The bucket should be configured with:
- Public access enabled
- Allowed MIME types: `image/*` and `video/mp4`
- File size limit: 100MB
