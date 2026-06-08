"use client";

// Song-change repaint — the dramatic hand-off between tracks.
// When the song switches, the NEW album cover is repainted onto the sheet as a
// field of flowing brush strokes that follow the cover's OWN contours (a painterly,
// Hertzmann-meets-flow-field rendering — see app/lib/painterly.ts), brushed on
// corner-to-corner like a hand laying down paint, where it lingers behind the
// doodles and then slowly DRIES away.
//   · ground : sits BELOW SongScapeInk, pressed into the paper (multiply by day,
//              screen at night), so the doodles ink ON TOP of the drying paint.
//   · once   : one-shot per switch. Skipped on first load and under reduced-motion.

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useNowPlayingContext } from "./NowPlayingContext";
import { analyzeCover, planPainting, animatePainting, type PaintController } from "@/app/lib/painterly";

const HOLD = 1.6; // s the paint sits wet before it begins to dry
const FADE = 8.5; // s slow dry-out (paint drying)

function fnv(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function CoverReveal() {
  const { track } = useNowPlayingContext();
  const reduced = useReducedMotion();

  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState<{ url: string; key: string; id: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startedFor = useRef<string | null>(null);
  const cycle = useRef(0);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const songKey = track ? track.trackId || `${track.title}${track.artist}${track.album}` : "—";
  const albumUrl = track?.albumImageUrl || null;

  // fire one repaint per genuine track change (skip first paint + no-cover)
  useEffect(() => {
    if (reduced) return;
    if (!songKey || songKey === "—") return;
    if (startedFor.current === null) {
      startedFor.current = songKey; // adopt the first song silently — no intro flash
      return;
    }
    if (songKey === startedFor.current) return;
    startedFor.current = songKey;
    if (!albumUrl) {
      setActive(null);
      return;
    }
    cycle.current += 1;
    setActive({ url: albumUrl, key: songKey, id: cycle.current });
  }, [songKey, albumUrl, reduced]);

  // run the painting for the active cycle (load → analyse → animate → dry)
  useEffect(() => {
    if (!active || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    let ctrl: PaintController | null = null;
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    const finish = () => setActive((a) => (a && a.id === active.id ? null : a));

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.transition = "none";
    canvas.style.opacity = String(dark ? 0.55 : 0.62);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!alive) return;
      const an = analyzeCover(img, img.naturalWidth || 640, img.naturalHeight || 640, w, h, 240);
      if (!an) {
        finish();
        return;
      }
      const painting = planPainting(an.rgb, an.AW, an.AH, w, h, { dark, seed: fnv(active.key) });
      ctrl = animatePainting(ctx, painting, dpr, () => performance.now(), () => {
        if (!alive) return;
        // paint laid down → let it dry: a long slow fade after a held beat
        canvas.style.transition = `opacity ${FADE}s ease-in ${HOLD}s`;
        canvas.style.opacity = "0";
        unmountTimer.current = setTimeout(finish, (HOLD + FADE) * 1000 + 400);
      });
    };
    img.onerror = () => alive && finish();
    img.src = active.url;

    return () => {
      alive = false;
      ctrl?.cancel();
      if (unmountTimer.current) clearTimeout(unmountTimer.current);
    };
  }, [active, reduced, dark]);

  if (!mounted || reduced || !active) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ mixBlendMode: dark ? "screen" : "multiply" }}
      />
    </div>
  );
}
