// Main-thread side of the paint worker: hand the repaint's two layers, cover
// and job over to app/lib/painter.worker.ts and get told when the paint is laid
// down. Returns null whenever the worker path is not usable, so the caller can
// fall back to painting on this thread.

import type { AvoidBox } from "./painterly";

export interface PaintJob {
  w: number;
  h: number;
  dryDpr: number;
  wetDpr: number;
  dark: boolean;
  seed: number;
  avoid: AvoidBox[];
}

export interface PaintHandle {
  /** resolves once the paint is fully laid down (or could not be painted) */
  done: Promise<"painted" | "failed">;
  /** tear the worker down — safe at any point, including mid-plan */
  dispose: () => void;
}

// One failed spin-up (no module workers, a CSP that blocks the chunk) is enough
// to stop trying for the rest of the session.
let unusable = false;

export function workerPaintSupported(canvas: HTMLCanvasElement): boolean {
  return (
    !unusable &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function" &&
    typeof canvas.transferControlToOffscreen === "function"
  );
}

export async function paintInWorker(
  dryCanvas: HTMLCanvasElement,
  wetCanvas: HTMLCanvasElement,
  cover: CanvasImageSource,
  job: PaintJob,
): Promise<PaintHandle | null> {
  if (!workerPaintSupported(dryCanvas)) return null;

  let worker: Worker;
  try {
    worker = new Worker(new URL("./painter.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    unusable = true;
    return null;
  }

  // Handshake first. transferControlToOffscreen is one-way — a canvas given to
  // a worker that never boots is simply lost — so prove the worker is alive
  // before handing anything over.
  const ready = await new Promise<boolean>((resolve) => {
    const bail = setTimeout(() => resolve(false), 4000);
    worker.onerror = () => {
      clearTimeout(bail);
      resolve(false);
    };
    worker.onmessage = (e: MessageEvent<{ type?: string }>) => {
      if (e.data?.type !== "ready") return;
      clearTimeout(bail);
      resolve(true);
    };
    worker.postMessage({ type: "ping" });
  });
  if (!ready) {
    worker.terminate();
    unusable = true;
    return null;
  }

  let bitmap: ImageBitmap;
  let dry: OffscreenCanvas;
  let wet: OffscreenCanvas;
  try {
    bitmap = await createImageBitmap(cover);
  } catch {
    worker.terminate();
    return null;
  }
  try {
    dry = dryCanvas.transferControlToOffscreen();
    wet = wetCanvas.transferControlToOffscreen();
  } catch {
    bitmap.close();
    worker.terminate();
    return null;
  }

  let settle: (how: "painted" | "failed") => void = () => {};
  const done = new Promise<"painted" | "failed">((resolve) => {
    settle = resolve;
    worker.onmessage = (e: MessageEvent<{ type?: string }>) => {
      if (e.data?.type === "done") resolve("painted");
      else if (e.data?.type === "failed") resolve("failed");
    };
    worker.onerror = () => resolve("failed");
  });
  worker.postMessage({ type: "paint", dry, wet, bitmap, ...job }, [dry, wet, bitmap]);
  return {
    done,
    dispose: () => {
      worker.terminate();
      settle("failed"); // never leave a caller awaiting a worker that is gone
    },
  };
}
