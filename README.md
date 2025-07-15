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
- **Image Uploads**: Drag & drop or click to upload images (max 25MB)
- **Video Uploads**: Upload MP4 videos (max 100MB) with automatic insertion at cursor position
- **Math Support**: KaTeX integration for mathematical expressions
- **Code Highlighting**: Syntax highlighting for code blocks

### Media Support
- **Images**: JPG, PNG, GIF, WebP support
- **Videos**: MP4 format with HTML5 video player
- **External Media**: YouTube and SoundCloud embeds
- **Responsive Design**: Mobile-friendly upload interface

## Setup

### Storage Buckets
The application requires two Supabase storage buckets:
- `images` - for image uploads (max 25MB per file)
- `videos` - for video uploads (max 100MB per file)

Run the setup script to create the required buckets:
```bash
node setup-storage.js
```

Make sure to set the following environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
