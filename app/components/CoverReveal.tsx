"use client";

// Song-change repaint — the dramatic hand-off between tracks.
// When the song switches, the NEW album cover is repainted onto the sheet as a
// field of flowing brush strokes that follow the cover's OWN contours (a painterly,
// Hertzmann-meets-flow-field rendering — see app/lib/painterly.ts), brushed on
// corner-to-corner like a hand laying down paint, where it lingers behind the
// doodles and then slowly DRIES away.
//   · ground : sits BELOW SongScapeInk, pressed into the paper (multiply by day,
//              screen at night), so the doodles ink ON TOP of the drying paint.
//   · once   : one-shot per switch, and once on first load when the song
//              resolves. Skipped only under reduced-motion.

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useNowPlayingContext } from "./NowPlayingContext";
import { analyzeCover, planPaintingAsync, animatePainting, type PaintController } from "@/app/lib/painterly";

const HOLD = 1.6; // s the paint sits wet before it begins to dry
const FADE = 8.5; // s slow dry-out (paint drying)

// Backing-store budget (device px). The wash is a soft, semi-transparent
// full-screen layer behind grain — nothing type-sharp lives on it — so on big
// retina screens rendering at full 2× (7MP+ cleared and re-composited every
// frame) buys nothing visible. Capping the pixel count is the single biggest
// per-frame saving; small/hi-dpi phone windows come in under budget unchanged.
const PIXEL_BUDGET = 4_500_000;

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

  // fire one repaint per genuine track change — including the very first song
  // on page load, so the inkscape always plays once the now-playing resolves.
  useEffect(() => {
    if (reduced) return;
    if (!songKey || songKey === "—") return;
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
    let plan: ReturnType<typeof planPaintingAsync> | null = null;
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    const finish = () => setActive((a) => (a && a.id === active.id ? null : a));

    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(
      2,
      window.devicePixelRatio || 1,
      Math.max(1, Math.sqrt(PIXEL_BUDGET / (w * h))),
    );
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.transition = "none";
    canvas.style.opacity = String(dark ? 0.55 : 0.72);
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
      // plan in frame-budgeted slices — the stroke planner is the one big
      // synchronous block, and running it whole caused a visible hitch right
      // as the repaint (and the doodles' write-in) kicked off
      plan = planPaintingAsync(an.rgb, an.AW, an.AH, w, h, { dark, seed: fnv(active.key) });
      plan.promise.then((painting) => {
        if (!alive || !painting) return;
        ctrl = animatePainting(ctx, painting, dpr, () => performance.now(), () => {
          if (!alive) return;
          // paint laid down → let it dry: a long slow fade after a held beat
          canvas.style.transition = `opacity ${FADE}s ease-in ${HOLD}s`;
          canvas.style.opacity = "0";
          unmountTimer.current = setTimeout(finish, (HOLD + FADE) * 1000 + 400);
        });
      });
    };
    img.onerror = () => alive && finish();
    img.src = active.url;

    return () => {
      alive = false;
      plan?.cancel();
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
