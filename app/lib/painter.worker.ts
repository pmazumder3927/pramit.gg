// The song-change repaint, run OFF the main thread.
//
// Planning a painting and then relaying its wet front every frame is real work,
// and it used to land on the main thread at exactly the moment the page was
// busiest (hydration, the doodles writing in, the lyric pen, the covers
// decoding), so the whole site stuttered while the album art washed on. Here
// the engine owns the two OffscreenCanvases CoverReveal hands over and does all
// of it on a worker thread: the main thread hands over one ImageBitmap and then
// only composites. Nothing about the painting itself changes — same planner,
// same seed, same strokes (see app/lib/painterly.ts).

import {
  analyzeCover,
  planPainting,
  animatePainting,
  type AvoidBox,
  type Ctx2D,
  type PaintController,
} from "./painterly";

export interface PaintRequest {
  type: "paint";
  dry: OffscreenCanvas;
  wet: OffscreenCanvas;
  dryDpr: number;
  wetDpr: number;
  bitmap: ImageBitmap;
  w: number;
  h: number;
  dark: boolean;
  seed: number;
  avoid: AvoidBox[];
}

type Incoming = PaintRequest | { type: "ping" };

const scope = self as unknown as {
  postMessage: (message: unknown) => void;
  requestAnimationFrame?: (cb: (t: number) => void) => number;
  cancelAnimationFrame?: (id: number) => void;
};

// Chromium drives worker rAF off the display's cadence; where it is missing
// (Safari, Firefox) a timer keeps the same code path running.
if (typeof scope.requestAnimationFrame !== "function") {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let next = 1;
  scope.requestAnimationFrame = (cb) => {
    const id = next++;
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        cb(performance.now());
      }, 16),
    );
    return id;
  };
  scope.cancelAnimationFrame = (id) => {
    const t = timers.get(id);
    if (t !== undefined) clearTimeout(t);
    timers.delete(id);
  };
}

let ctrl: PaintController | null = null;

self.onmessage = (e: MessageEvent<Incoming>) => {
  const msg = e.data;
  if (!msg) return;
  if (msg.type === "ping") {
    // the handshake CoverReveal waits on before handing over its canvases — a
    // canvas transferred to a worker that never starts can never come back
    scope.postMessage({ type: "ready" });
    return;
  }
  if (msg.type !== "paint") return;

  ctrl?.cancel();
  ctrl = null;
  const { dry, wet, dryDpr, wetDpr, bitmap, w, h, dark, seed, avoid } = msg;
  const dctx = dry.getContext("2d") as unknown as Ctx2D | null;
  const wctx = wet.getContext("2d") as unknown as Ctx2D | null;
  const an =
    dctx && wctx ? analyzeCover(bitmap, bitmap.width, bitmap.height, w, h, 240) : null;
  bitmap.close();
  if (!dctx || !wctx || !an) {
    scope.postMessage({ type: "failed" });
    return;
  }
  // Planned in one go: off the main thread there is no frame to stall, so the
  // sliced planner (which only exists to keep the main thread breathing) would
  // just add scheduling overhead. Same generator, drained straight through.
  const painting = planPainting(an.rgb, an.AW, an.AH, w, h, { dark, seed, avoid });
  ctrl = animatePainting(
    { dry: dctx, dryDpr, wet: wctx, wetDpr },
    painting,
    () => performance.now(),
    () => {
      ctrl = null;
      scope.postMessage({ type: "done" });
    },
  );
};
