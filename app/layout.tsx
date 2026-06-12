import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  Caveat,
  Work_Sans,
  Ma_Shan_Zheng,
  Nanum_Pen_Script,
  Kalam,
  Yuji_Syuku,
  Noto_Sans_Egyptian_Hieroglyphs,
} from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { siteConfig } from "./lib/metadata";
import NowPlaying from "./components/NowPlaying";
import SketchbookNav from "./components/SketchbookNav";
import SketchbookTabBar from "./components/SketchbookTabBar";
import { NowPlayingProvider } from "./components/NowPlayingContext";
import PaperBackground from "./components/PaperBackground";
import PageTurnInk from "./components/PageTurnInk";
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

// Chinese brush-script handwriting for lyrics in CJK. preload:false (and no
// subsets) so this large font is fetched lazily — only when a glyph that needs
// it actually renders, i.e. when a Chinese song is playing. Latin still uses
// Caveat; this only catches glyphs Caveat lacks, via the font stack.
const maShanZheng = Ma_Shan_Zheng({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-cjk-hand",
});

// Korean pen-handwriting for lyrics, lazy-loaded like the Chinese face above.
const nanumPen = Nanum_Pen_Script({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-kr-hand",
});

// Hindi (Devanagari) handwriting for lyrics; smaller than the CJK faces but
// still lazy so it only loads when a Devanagari glyph renders.
const kalam = Kalam({
  weight: "400",
  subsets: ["devanagari"],
  display: "swap",
  preload: false,
  variable: "--font-hi-hand",
});

// Bengali handwriting for lyrics — self-hosted "BenSen Handwriting" (GPL w/ font
// exception). Google's Bengali set has no true handwriting face (only the brush-
// display Galada / calligraphic Tiro Bangla), so this is local. Lazy via
// preload:false so it only loads when a Bengali song renders.
const bensenHandwriting = localFont({
  src: "./fonts/bensen-handwriting-regular.woff2",
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-bn-hand",
});

// Japanese brush face (kana + kanji) for the confessional glyph challenge. Same
// brush spirit as the Chinese Ma Shan Zheng above so CJK inscriptions look
// cohesive. Lazy (preload:false, no subsets) — only fetched when a Japanese
// glyph challenge actually renders on the connect page.
const yujiSyuku = Yuji_Syuku({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-jp-hand",
});

// Egyptian hieroglyphs for the glyph challenge. Covers the full Unicode
// hieroglyph block. Lazy like the faces above.
const egyptianHieroglyphs = Noto_Sans_Egyptian_Hieroglyphs({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-egyptian",
});

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${caveat.variable} ${workSans.variable} ${maShanZheng.variable} ${nanumPen.variable} ${kalam.variable} ${bensenHandwriting.variable} ${yujiSyuku.variable} ${egyptianHieroglyphs.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <JsonLd data={[personSchema, websiteSchema]} />
        <link rel="dns-prefetch" href="https://i.scdn.co" />
        <link rel="dns-prefetch" href="https://mosaic.scdn.co" />
        <link rel="dns-prefetch" href="https://img.youtube.com" />
        <link rel="preconnect" href="https://i.scdn.co" crossOrigin="anonymous" />
      </head>
      <body className="grain min-h-screen">
        <PostHogProvider>
          <NowPlayingProvider>
            <AlbumThemeVars />
            <PaperBackground />
            <PageTurnInk />
            <SketchbookNav />
            {/* extra bottom space on mobile so content clears the fixed tab bar */}
            <div className="relative z-10 pb-[calc(env(safe-area-inset-bottom)+4.25rem)] md:pb-0">
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
