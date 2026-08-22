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
//              happens on a WORKER against OffscreenCanvases. This layer used
//              to paint on the main thread at the exact moment the page was
//              busiest (hydration, doodles, lyrics, covers decoding) and the
//              site stuttered right through the first wash. Browsers without
//              OffscreenCanvas fall back to painting here, as before.
//   · layers : TWO stacked canvases in one isolated, blended group. The lower
//              holds the settled marks at full device resolution and is only
//              ever added to; the upper holds just the marks mid-growth and is
//              the only thing redrawn each frame, at half resolution, because
//              nothing stays on it longer than a stroke takes to land. Relaying
//              the whole viewport at dpr 2 every frame was a fill-rate wall on
//              integrated graphics (8.5fps at 1920×1080; the same painting at
//              dpr 1 ran at sixty). The painting you hold and dry is unchanged.

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

  const groupRef = useRef<HTMLDivElement | null>(null);
  const dryRef = useRef<HTMLCanvasElement | null>(null);
  const wetRef = useRef<HTMLCanvasElement | null>(null);
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
    const group = groupRef.current;
    const dryCanvas = dryRef.current;
    const wetCanvas = wetRef.current;
    if (!group || !dryCanvas || !wetCanvas) return;
    let alive = true;
    let dispose: (() => void) | null = null;
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    const finish = () => setActive((a) => (a && a.id === active.id ? null : a));

    const w = window.innerWidth;
    const h = window.innerHeight;
    // the settled layer keeps the full min(2, dpr) — a cap was tried once for
    // perf and visibly softened the strokes; the owner keeps the crispness
    // (see memory: songscape-backdrop "dpr REGRESSION"). Only the wet front,
    // which no mark stays on for longer than it takes to land, runs coarser.
    const dryDpr = Math.min(2, window.devicePixelRatio || 1);
    const wetDpr = Math.min(1, dryDpr);
    // set BEFORE the canvases are handed to the worker — once transferred,
    // their size belongs to the worker and cannot be touched from here
    dryCanvas.width = Math.round(w * dryDpr);
    dryCanvas.height = Math.round(h * dryDpr);
    wetCanvas.width = Math.round(w * wetDpr);
    wetCanvas.height = Math.round(h * wetDpr);
    group.style.transition = "none";
    group.style.opacity = String(dark ? 0.55 : 0.72);

    // paint laid down → let it dry: a long slow fade after a held beat
    const dry = () => {
      if (!alive) return;
      group.style.transition = `opacity ${FADE}s ease-in ${HOLD}s`;
      group.style.opacity = "0";
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

      const handle = await paintInWorker(dryCanvas, wetCanvas, img, {
        w,
        h,
        dryDpr,
        wetDpr,
        ...opts,
      });
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
      const dctx = dryCanvas.getContext("2d");
      const wctx = wetCanvas.getContext("2d");
      const an =
        dctx && wctx
          ? analyzeCover(img, img.naturalWidth || 640, img.naturalHeight || 640, w, h, 240)
          : null;
      if (!dctx || !wctx || !an) {
        finish();
        return;
      }
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
      ctrl = animatePainting(
        { dry: dctx, dryDpr, wet: wctx, wetDpr },
        painting,
        () => performance.now(),
        dry,
      );
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
      {/* One isolated, blended group holding both layers, so wet-over-dry
          composites inside it and only the finished stack meets the sheet —
          exactly what the single canvas used to hand the page. Opacity lives
          here too, so the dry-out fades the whole painting as one.
          Keyed per cycle AND per sheet: a canvas can only be handed to a worker
          once, so every (re)paint — a new song, or a theme flip mid-wash —
          gets fresh elements rather than reusing transferred ones. */}
      <div
        key={`${active.id}-${dark ? "night" : "day"}`}
        ref={groupRef}
        className="absolute inset-0"
        style={{ isolation: "isolate", mixBlendMode: dark ? "screen" : "multiply" }}
      >
        <canvas ref={dryRef} className="absolute inset-0 h-full w-full" />
        <canvas ref={wetRef} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
