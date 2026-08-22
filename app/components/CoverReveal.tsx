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
//   · thread : the whole render — planner and every frame of the wet front —
//              happens on a WORKER against an OffscreenCanvas. This layer used
//              to paint on the main thread at the exact moment the page was
//              busiest (hydration, doodles, lyrics, covers decoding) and the
//              site stuttered right through the first wash. Browsers without
//              OffscreenCanvas fall back to painting here, as before.

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useNowPlayingContext } from "./NowPlayingContext";
import { paintInWorker } from "@/app/lib/painter-client";
import { collectForegroundRects } from "@/app/lib/scape-layout";

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

function loadCover(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
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

  // run the painting for the active cycle (load → hand off → paint → dry)
  useEffect(() => {
    if (!active || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    let dispose: (() => void) | null = null;
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    const finish = () => setActive((a) => (a && a.id === active.id ? null : a));

    const w = window.innerWidth;
    const h = window.innerHeight;
    // full min(2, dpr) — a 1.5 cap was tried once for perf and visibly
    // softened the strokes; the owner keeps the crispness (see memory:
    // songscape-backdrop "dpr REGRESSION"). Perf comes from painting off the
    // main thread instead.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // set BEFORE the canvas is handed to the worker — once transferred, its
    // size belongs to the worker and cannot be touched from here
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.transition = "none";
    canvas.style.opacity = String(dark ? 0.55 : 0.72);

    // paint laid down → let it dry: a long slow fade after a held beat
    const dry = () => {
      if (!alive) return;
      canvas.style.transition = `opacity ${FADE}s ease-in ${HOLD}s`;
      canvas.style.opacity = "0";
      unmountTimer.current = setTimeout(finish, (HOLD + FADE) * 1000 + 400);
    };

    void (async () => {
      const img = await loadCover(active.url);
      if (!alive) return;
      if (!img) {
        finish();
        return;
      }
      // the paint flows AROUND the page's readable content (same measurement
      // the lyrics use), squiggling along its edges instead of washing under
      // the words. Measured at paint start — viewport px, like the canvas.
      // Unlike the lyric pen, the wash also avoids lyric-opted-out chrome
      // (the post TOC etc): true = include [data-lyrics-ignore] rects.
      const opts = { dark, seed: fnv(active.key), avoid: collectForegroundRects(true) };

      const handle = await paintInWorker(canvas, img, { w, h, dpr, ...opts });
      if (!alive) {
        handle?.dispose();
        return;
      }
      if (handle) {
        // the worker owns the canvas for the rest of the cycle; keep it alive
        // through the dry-out so the placeholder holds the painted frame
        dispose = handle.dispose;
        if ((await handle.done) === "painted") dry();
        else if (alive) finish();
        return;
      }

      // No OffscreenCanvas worker → paint here, as this layer always used to.
      // The engine only loads on this path, so the main thread never even
      // parses it when the worker is available.
      const { analyzeCover, planPaintingAsync, animatePainting } = await import(
        "@/app/lib/painterly"
      );
      if (!alive) return;
      const ctx = canvas.getContext("2d");
      const an = ctx
        ? analyzeCover(img, img.naturalWidth || 640, img.naturalHeight || 640, w, h, 240)
        : null;
      if (!ctx || !an) {
        finish();
        return;
      }
      ctx.scale(dpr, dpr);
      // plan in frame-budgeted slices — the stroke planner is the one big
      // synchronous block, and running it whole caused a visible hitch right
      // as the repaint (and the doodles' write-in) kicked off
      const plan = planPaintingAsync(an.rgb, an.AW, an.AH, w, h, opts);
      let ctrl: { cancel: () => void } | null = null;
      dispose = () => {
        plan.cancel();
        ctrl?.cancel();
      };
      const painting = await plan.promise;
      if (!alive || !painting) return;
      ctrl = animatePainting(ctx, painting, dpr, () => performance.now(), dry);
    })();

    return () => {
      alive = false;
      dispose?.();
      if (unmountTimer.current) clearTimeout(unmountTimer.current);
    };
  }, [active, reduced, dark]);

  if (!mounted || reduced || !active) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* keyed per cycle AND per sheet: a canvas can only be handed to a worker
          once, so every (re)paint — a new song, or a theme flip mid-wash —
          gets a fresh element rather than reusing a transferred one */}
      <canvas
        key={`${active.id}-${dark ? "night" : "day"}`}
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ mixBlendMode: dark ? "screen" : "multiply" }}
      />
    </div>
  );
}
