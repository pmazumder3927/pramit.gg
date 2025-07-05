# pramit.gg

A personal digital space - a living, evolving journal of interests, projects, and experiences.

## Features

- **Minimalist Design**: Black and white foundation with cyberpunk orange and purple accents
- **Content Types**: Music clips, climbing videos, and notes with full markdown support
- **Quick Publishing**: Create posts in under 60 seconds from your phone
- **Mobile-First**: Optimized for viewing and creating content on mobile devices
- **Fast & Modern**: Built with Next.js 14, TypeScript, and Tailwind CSS
- **Live Spotify Integration**: Shows your current or last played track with album art
- **Hidden Dashboard**: Secret keyboard shortcuts for content management

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Animations**: Framer Motion
- **Backend**: Supabase (Database, Auth, Storage)
- **Media**: React Player (YouTube, SoundCloud embeds)
- **Music**: Spotify Web API integration
- **Hosting**: Vercel

## Setup Instructions

### 1. Clone and Install

```bash
git clone [your-repo-url]
cd personal-website
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. In your Supabase dashboard, create the following table:

```sql
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT CHECK (type IN ('music', 'climb', 'note')) NOT NULL,
  media_url TEXT,
  tags TEXT[] DEFAULT '{}',
  accent_color TEXT NOT NULL,
  is_draft BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Public posts are viewable by everyone" ON posts
  FOR SELECT USING (is_draft = false);

-- Create policy for authenticated users to manage posts
CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own posts" ON posts
  FOR DELETE USING (auth.uid() IS NOT NULL);
```

3. Set up Google OAuth:
   - Go to Settings → Authentication → Providers
   - Enable Google provider
   - Add your Google OAuth credentials
   - Set redirect URL to `https://your-domain.com/api/auth/callback`

### 3. Set up Spotify Integration

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://localhost:3000` to redirect URIs for development
4. Note your Client ID and Client Secret
5. Get your refresh token:
   - Use the [Spotify Web API Auth Examples](https://github.com/spotify/web-api-examples) or
   - Use this [online tool](https://developer.spotify.com/console/get-current-user-recently-played-tracks/) to get authorization
   - Exchange the authorization code for a refresh token

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Spotify API
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token

# Site URL (for production)
NEXT_PUBLIC_SITE_URL=https://pramit.gg
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your site.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Configure Domain

1. In Vercel, go to your project settings
2. Add custom domain: `pramit.gg`
3. Follow Vercel's instructions to update your DNS records

## Usage Guide

### Accessing the Dashboard

The dashboard is hidden from public view. Access it using:
- **Keyboard shortcut**: `Cmd/Ctrl + Shift + D`
- **Konami code**: ↑↑↓↓←→←→BA (for fun!)

### Creating Posts (Dashboard)

1. Navigate to `/dashboard` using the secret shortcuts
2. Click "+ create new post"
3. For music/video posts: paste a YouTube or SoundCloud link
4. Add a title and your thoughts (supports full markdown)
5. Switch to markdown editor for long-form content with math equations
6. Add tags (comma-separated)
7. Choose to publish immediately or save as draft
8. Click "publish"

### Content Types

- **Music**: Paste SoundCloud links for embedded audio players
- **Climb**: Paste YouTube links for climbing videos
- **Note**: Text-based posts with full markdown support including:
  - Headers, lists, blockquotes
  - Code blocks with syntax highlighting
  - Math equations (KaTeX)
  - Tables and GitHub-flavored markdown

### Mobile Usage

The site is optimized for mobile creation and viewing:
- Bottom navigation bar on mobile
- Touch-friendly interface
- Quick creation flow
- Swipeable featured content
- Expandable "now playing" widget

### Spotify Integration

The "now playing" widget shows:
- Your currently playing track (with live progress bar)
- Your last played track if nothing is currently playing
- Album artwork and track details
- Click to expand for full details
- Direct link to open in Spotify

## Customization

### Colors

Edit the color palette in `tailwind.config.ts`:
```js
colors: {
  'cyber-orange': '#ff6b3d',
  'neon-purple': '#9c5aff',
  'deep-graphite': '#1a1b22',
}
```

### Animations

Modify animations in `tailwind.config.ts` or create new Framer Motion variants in components.

### Spotify Refresh Rate

The now playing widget refreshes every 30 seconds. Adjust in `components/NowPlaying.tsx`:
```js
refreshInterval: 30000, // milliseconds
```

## Development

### Project Structure

```
app/
├── components/       # Reusable components
│   ├── PostCard.tsx     # Individual post display
│   ├── Navigation.tsx   # Navigation component
│   ├── NowPlaying.tsx   # Spotify integration
│   └── SecretDashboard.tsx # Hidden dashboard access
├── lib/             # Utilities and configurations
├── api/             # API routes
│   ├── auth/           # Authentication routes
│   └── spotify/        # Spotify API integration
├── dashboard/       # Dashboard page
├── about/          # About page
├── post/[id]/      # Individual post pages
└── page.tsx        # Homepage
```

### Key Components

- `PostCard.tsx`: Individual post display with media handling and previews
- `Navigation.tsx`: Responsive navigation component
- `NowPlaying.tsx`: Live Spotify integration with expandable details
- `Dashboard`: Content management interface with markdown editor

## License

MIT 