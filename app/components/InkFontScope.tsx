"use client";

import { useEffect } from "react";
import {
  Ma_Shan_Zheng,
  Nanum_Pen_Script,
  Kalam,
  Yuji_Syuku,
  Noto_Sans_Egyptian_Hieroglyphs,
} from "next/font/google";
import localFont from "next/font/local";

// The niche script faces (lyric hands + glyph-challenge faces) carry ~70KB gz
// of @font-face declarations — two thirds of the site's render-blocking CSS
// when they were declared in the root layout. Declared here instead, they ride
// the chunks that actually use them (the idle-mounted scape and the connect
// captcha). The variables still land on <html>, so every existing
// var(--font-*) stack and documentElement lookup resolves exactly as before.
// Font configs mirror the old app/layout.tsx declarations verbatim.

// Chinese brush-script handwriting for lyrics in CJK. preload:false (and no
// subsets) so this large font is fetched lazily — only when a glyph that needs
// it actually renders. Latin still uses Caveat; this only catches glyphs
// Caveat lacks, via the font stack.
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

// Bengali handwriting for lyrics — self-hosted "BenSen Handwriting" (GPL w/
// font exception); Google's Bengali set has no true handwriting face.
const bensenHandwriting = localFont({
  src: "../fonts/bensen-handwriting-regular.woff2",
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-bn-hand",
});

// Japanese brush face (kana + kanji) for the confessional glyph challenge.
const yujiSyuku = Yuji_Syuku({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-jp-hand",
});

// Egyptian hieroglyphs for the glyph challenge.
const egyptianHieroglyphs = Noto_Sans_Egyptian_Hieroglyphs({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-egyptian",
});

const CLASSES = [
  maShanZheng.variable,
  nanumPen.variable,
  kalam.variable,
  bensenHandwriting.variable,
  yujiSyuku.variable,
  egyptianHieroglyphs.variable,
];

// Never removed once attached: bare declarations are inert (the woff2s only
// download when a glyph uses them), and another scope may still need them.
export function ensureInkFonts() {
  document.documentElement.classList.add(...CLASSES);
}

export default function InkFontScope() {
  useEffect(() => {
    ensureInkFonts();
  }, []);
  return null;
}
