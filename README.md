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

### Agentic media uploads

Article media belongs in Supabase Storage, not in `public/`. The browser writing
room uses signed uploads; local tooling can publish the same media with the
service role from the ignored `.env` file:

```bash
npm run media:upload -- --collection openaim /tmp/openaim-run.mp4 /tmp/openaim-run-poster.webp
```

The command accepts images, MP4 video, and HTML under 100MB. It writes immutable,
content-addressed objects below `images/uploads/<collection>/`, sets a one-year
cache lifetime, and prints the public URL plus ready-to-paste Markdown. Repeating
the same upload reuses the existing object. Never commit the service role key or
the source media.
