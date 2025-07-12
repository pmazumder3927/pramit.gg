# pramit.gg

my personal blog/journal/whatever

https://www.pramit.gg/post/why-i-bothered

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Animations**: Framer Motion
- **Backend**: Supabase (Database, Auth, Storage)
- **Media**: React Player (YouTube, SoundCloud embeds)
- **Music**: Spotify Web API integration
- **Hosting**: Vercel

## BlobLoader & LoadingProvider (Page-transition animation)

The fluid *blob* loading animation is implemented in two parts:

1. **`BlobLoader`** – low-level canvas renderer that animates an organic
   particle mass. You normally don’t use this component directly.
2. **`LoadingProvider`** – React Context provider that manages global
   loading state and mounts a single `BlobLoader` overlay so it can
   accompany you between pages.

### Installation

No extra runtime dependencies are required – everything is built with
React + the browser canvas API. Type definitions live in the project and
are picked up automatically.

### Basic usage

Wrap your application (or any sub-tree) in the provider:

```tsx
<LoadingProvider>
  {/* your existing app tree */}
</LoadingProvider>
```

In the default setup this is already done inside `app/layout.tsx`, so the
blob animation will show whenever the route changes.

### Programmatic control

Inside any client component, import the helper hook:

```tsx
import { useGlobalLoading } from '@/app/components/LoadingProvider';

const { startLoading, stopLoading } = useGlobalLoading();

// e.g. fire the loader while fetching
async function handleClick() {
  startLoading();
  await doSomethingAsync();
  stopLoading();
}
```

### Performance monitoring

The loader measures frames-per-second internally. In development mode an
FPS read-out is rendered in the top-left corner. If the average FPS
drops below ~50, a warning is emitted to the console so you can further
optimise the effect.

---
