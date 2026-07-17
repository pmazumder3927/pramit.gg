import type { Metadata, Viewport } from "next";
import { Fraunces, Caveat, Work_Sans } from "next/font/google";
import "./globals.css";
import { siteConfig } from "./lib/metadata";
import NowPlaying from "./components/NowPlaying";
import SketchbookNav from "./components/SketchbookNav";
import SketchbookTabBar from "./components/SketchbookTabBar";
import { NowPlayingProvider } from "./components/NowPlayingContext";
import PaperBackground from "./components/PaperBackground";
import PageTurnInk from "./components/PageTurnInk";
import ChunkReload from "./components/ChunkReload";
import AlbumThemeVars from "./components/AlbumThemeVars";
import JsonLd from "./components/JsonLd";
import { personSchema, websiteSchema } from "./lib/structured-data";
import { PostHogProvider } from "./providers";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-caveat",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-work",
});

// The niche script faces (CJK/JP/KR/HI/BN lyric hands, hieroglyphs) are NOT
// declared here — their @font-face declarations alone were ~70KB gz of
// render-blocking CSS on every page. They live in
// app/components/InkFontScope.tsx, mounted by the lazy scape chunk and the
// connect captcha, which attaches the same --font-* variables to <html>.

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} · ${siteConfig.author}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.author, url: siteConfig.url }],
  creator: siteConfig.creator,
  alternates: {
    canonical: "/",
    types: {
      "application/atom+xml": [
        { url: "/feed.xml", title: `${siteConfig.name} · atom feed` },
      ],
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: `${siteConfig.name} · ${siteConfig.author}`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    // Social image comes from app/opengraph-image.tsx (generated at the edge)
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} · ${siteConfig.author}`,
    description: siteConfig.description,
    creator: siteConfig.creator,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Icons are provided by file conventions: app/icon.svg, app/favicon.ico, app/apple-icon.png
  manifest: "/site.webmanifest",
};

// viewport-fit: cover lets the bottom tab bar honor the iOS home-indicator inset.
export const viewport: Viewport = {
  viewportFit: "cover",
};

// Runs before paint to set the theme class, avoiding a flash of the wrong theme.
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

// The Supabase storage origin serves post covers, the collage banner, and
// inline post images — warm the connection alongside the Spotify CDN hints.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
})();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${caveat.variable} ${workSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <JsonLd data={[personSchema, websiteSchema]} />
        <link rel="dns-prefetch" href="https://i.scdn.co" />
        <link rel="dns-prefetch" href="https://mosaic.scdn.co" />
        <link rel="dns-prefetch" href="https://img.youtube.com" />
        <link rel="preconnect" href="https://i.scdn.co" crossOrigin="anonymous" />
        {supabaseOrigin && (
          <>
            <link rel="dns-prefetch" href={supabaseOrigin} />
            <link rel="preconnect" href={supabaseOrigin} />
          </>
        )}
      </head>
      <body className="grain min-h-screen">
        {/* invisible until keyboard-focused; jumps past the chrome */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:block focus:rounded-md focus:border-2 focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:font-hand focus:text-lg focus:text-ink"
        >
          skip to the page
        </a>
        <PostHogProvider>
          <NowPlayingProvider>
            <ChunkReload />
            <AlbumThemeVars />
            <PaperBackground />
            <PageTurnInk />
            <SketchbookNav />
            {/* extra bottom space on mobile so content clears the fixed tab
                bar; --tabbar-h is kept current by SketchbookTabBar (it grows
                when the now-playing ticket rides on the bar) */}
            <div
              id="main-content"
              className="relative z-10 pb-[var(--tabbar-h,calc(env(safe-area-inset-bottom)+4.25rem))] md:pb-0"
            >
              {children}
            </div>
            <NowPlaying />
            <SketchbookTabBar />
          </NowPlayingProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
