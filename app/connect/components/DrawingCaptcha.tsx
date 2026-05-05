"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_MAX_LEVEL,
  type ConfessionalCaptchaChallenge,
  type ConfessionalCaptchaSubmission,
  evaluateDrawing,
} from "@/app/lib/confessional-captcha";
import { BRUSH_ORDER } from "@/app/lib/drawing/brushes";
import { renderScene, renderStroke } from "@/app/lib/drawing/paint";
import { randomSeed } from "@/app/lib/drawing/rng";
import { lowPass, simplify } from "@/app/lib/drawing/smoothing";
import type {
  BrushId,
  DrawingPoint,
  DrawingStroke,
} from "@/app/lib/drawing/types";

type DrawingCaptchaProps = {
  disabled?: boolean;
  refreshKey?: number;
  onChange: (
    payload: ConfessionalCaptchaSubmission | null,
    ready: boolean,
  ) => void;
};

type CaptchaResponse = {
  token: string;
  challenge: ConfessionalCaptchaChallenge;
};

type ToolMode = "brush" | "line" | "rect" | "ellipse";

const COLOR_PRESETS = [
  "#f5f5f5",
  "#0c0816",
  "#f8a4c8",
  "#ffd36d",
  "#b7ffca",
  "#b9ddff",
  "#d0c0ff",
  "#9df4f2",
  "#ff8f6b",
  "#a87bf2",
];

const DEFAULT_BRUSH: BrushId = "pen";
const DEFAULT_COLOR = COLOR_PRESETS[0];
const DEFAULT_WIDTH = 6;
const DEFAULT_OPACITY = 1;
const MIN_WIDTH = 1;
const MAX_WIDTH = 48;
const HISTORY_LIMIT = 50;
const SMOOTHING_ALPHA = 0.45;
const ELLIPSE_SEGMENTS = 48;
const SNAPSHOT_DEBOUNCE_MS = 700;

const BRUSH_LABELS: Record<BrushId, string> = {
  pen: "pen",
  fineliner: "fine",
  pencil: "pencil",
  marker: "marker",
  brush: "brush",
  charcoal: "char",
  watercolor: "wash",
  spray: "spray",
  eraser: "eraser",
};

export default function DrawingCaptcha({
  disabled = false,
  refreshKey = 0,
  onChange,
}: DrawingCaptchaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const committedRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<HTMLCanvasElement | null>(null);
  const dimsRef = useRef<{ cssW: number; cssH: number; dpr: number }>({
    cssW: 0,
    cssH: 0,
    dpr: 1,
  });

  // Stroke state.
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [past, setPast] = useState<DrawingStroke[][]>([]);
  const [future, setFuture] = useState<DrawingStroke[][]>([]);

  // Mirror to a ref so callbacks (resize observer, rAF) read the latest
  // strokes without rebuilding their closures.
  const strokesRef = useRef<DrawingStroke[]>(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  // Stash onChange in a ref so parent-side inline lambdas don't re-fire the
  // payload effect every render — that loop would tank performance even
  // before the user touches the canvas.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Tool settings.
  const [brushId, setBrushId] = useState<BrushId>(DEFAULT_BRUSH);
  const [tool, setTool] = useState<ToolMode>("brush");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [opacity, setOpacity] = useState<number>(DEFAULT_OPACITY);

  // UI state.
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Imperative drawing state — kept in refs so pointer-moves don't
  // trigger React re-renders.
  const drawingRef = useRef<{
    pointerId: number;
    startTime: number;
    raw: DrawingPoint[];
    smoothed: DrawingPoint[];
    last: DrawingPoint | null;
    brush: BrushId;
    color: string;
    width: number;
    opacity: number;
    seed: number;
    tool: ToolMode;
    dirty: boolean;
    rafQueued: boolean;
  } | null>(null);

  // Captcha challenge.
  const [challengeResponse, setChallengeResponse] =
    useState<CaptchaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const challenge = challengeResponse?.challenge ?? null;
  const token = challengeResponse?.token ?? "";
  const drawingEvaluation = evaluateDrawing(strokes);
  const ready = Boolean(challenge && drawingEvaluation.ok);

  const loadChallenge = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/confessional", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load the challenge.");
      const data = (await response.json()) as CaptchaResponse;
      setChallengeResponse(data);
    } catch (error) {
      console.error("Captcha load error:", error);
      setLoadError("Could not summon the council. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset on a new challenge / parent-triggered refresh.
  useEffect(() => {
    setStrokes([]);
    setPast([]);
    setFuture([]);
    drawingRef.current = null;
    if (committedRef.current) clearCanvas(committedRef.current);
    if (liveRef.current) clearCanvas(liveRef.current);
    void loadChallenge();
  }, [loadChallenge, refreshKey]);

  // Resize handler — independent from strokes so committing a new stroke
  // doesn't cause a full canvas repaint. Only redoes the committed paint
  // when the DPR-scaled pixel dims actually change.
  useEffect(() => {
    function resize() {
      const wrapper = wrapperRef.current;
      const committed = committedRef.current;
      const live = liveRef.current;
      if (!wrapper || !committed || !live) return;
      const rect = wrapper.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const cssW = rect.width;
      const cssH = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = Math.round(DRAWING_CANVAS_WIDTH * dpr);
      const h = Math.round(DRAWING_CANVAS_HEIGHT * dpr);

      const dimsChanged =
        committed.width !== w ||
        committed.height !== h ||
        dimsRef.current.cssW !== cssW ||
        dimsRef.current.cssH !== cssH;

      for (const canvas of [committed, live]) {
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      dimsRef.current = { cssW, cssH, dpr };

      if (dimsChanged) {
        const ctx = committed.getContext("2d");
        if (ctx) {
          clearCanvasPixels(committed);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderScene(ctx, strokesRef.current);
        }
      }
    }

    resize();
    const observer = new ResizeObserver(resize);
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // When fullscreen toggles or the wrapper resizes, kick the resize routine
  // by triggering a layout read on next frame.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      // Force ResizeObserver to fire by reading then writing a noop style
      // — simply triggering a new measurement is enough.
      wrapper.getBoundingClientRect();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isFullscreen]);

  // Surface readiness to the parent on every stroke change. The snapshot is
  // generated lazily AFTER a quiet period, so fast scribbling doesn't pay
  // the toDataURL cost on every stroke.
  useEffect(() => {
    if (!ready || !challenge) {
      onChangeRef.current(null, false);
      return;
    }

    // Send a quick payload without snapshot so the parent's "ready" gate
    // updates immediately. Snapshot follows after the debounce.
    onChangeRef.current({ token, strokes }, true);

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      const snapshot = await composeSnapshot(committedRef.current);
      if (cancelled) return;
      onChangeRef.current({ token, strokes, snapshot }, true);
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [challenge, ready, strokes, token]);

  // ── Pointer flow ─────────────────────────────────────────────────────────

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !liveRef.current) return;
    const point = canvasPoint(event, liveRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);

    drawingRef.current = {
      pointerId: event.pointerId,
      startTime: performance.now(),
      raw: [point],
      smoothed: [point],
      last: point,
      brush: brushId,
      color,
      width,
      opacity,
      seed: randomSeed(),
      tool,
      dirty: true,
      rafQueued: false,
    };
    queueLivePaint();
  };

  const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!liveRef.current) return;
    const drawing = drawingRef.current;
    if (!drawing || drawing.pointerId !== event.pointerId) return;
    const point = canvasPoint(event, liveRef.current);
    const t = performance.now() - drawing.startTime;
    point.t = t;
    point.p = event.pressure || 0.5;

    if (drawing.tool === "brush") {
      drawing.raw.push(point);
      const smoothed = lowPass(drawing.last, point, SMOOTHING_ALPHA);
      smoothed.t = point.t;
      smoothed.p = point.p;
      drawing.smoothed.push(smoothed);
      drawing.last = smoothed;
    } else {
      drawing.raw[1] = point;
      drawing.last = point;
    }
    drawing.dirty = true;
    queueLivePaint();
  };

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drawing = drawingRef.current;
    if (!drawing || drawing.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const stroke = finalizeStroke(drawing);
    drawingRef.current = null;
    clearLiveCanvas();
    if (!stroke) return;

    const ctx = committedRef.current?.getContext("2d");
    if (ctx) renderStroke(ctx, stroke);

    pushHistory(strokes);
    setStrokes((prev) => [...prev, stroke]);
  };

  const cancelStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drawing = drawingRef.current;
    if (!drawing || drawing.pointerId !== event.pointerId) return;
    drawingRef.current = null;
    clearLiveCanvas();
  };

  // rAF-batched live paint. Multiple pointer-move events between frames
  // collapse into a single redraw.
  function queueLivePaint() {
    const drawing = drawingRef.current;
    if (!drawing || drawing.rafQueued) return;
    drawing.rafQueued = true;
    requestAnimationFrame(() => {
      const d = drawingRef.current;
      if (!d) return;
      d.rafQueued = false;
      if (!d.dirty) return;
      d.dirty = false;
      paintLive();
    });
  }

  function paintLive() {
    const live = liveRef.current;
    if (!live) return;
    const ctx = live.getContext("2d");
    if (!ctx) return;
    clearCanvas(live);
    const drawing = drawingRef.current;
    if (!drawing) return;

    const points =
      drawing.tool === "brush"
        ? drawing.smoothed
        : shapePoints(
            drawing.tool,
            drawing.raw[0],
            drawing.raw[1] ?? drawing.raw[0],
          );
    if (points.length === 0) return;

    renderStroke(ctx, {
      points,
      brush: drawing.brush,
      color: drawing.color,
      width: drawing.width,
      opacity: drawing.opacity,
      seed: drawing.seed,
      tool: drawing.brush === "spray" ? "spray" : undefined,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function canvasPoint(
    event: React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
  ): DrawingPoint {
    const bounds = canvas.getBoundingClientRect();
    const sx = DRAWING_CANVAS_WIDTH / Math.max(1, bounds.width);
    const sy = DRAWING_CANVAS_HEIGHT / Math.max(1, bounds.height);
    return {
      x: (event.clientX - bounds.left) * sx,
      y: (event.clientY - bounds.top) * sy,
      p: event.pressure || 0.5,
      t: 0,
    };
  }

  function finalizeStroke(
    drawing: NonNullable<typeof drawingRef.current>,
  ): DrawingStroke | null {
    if (drawing.tool === "brush") {
      if (drawing.smoothed.length === 0) return null;
      const path: DrawingPoint[] = [...drawing.smoothed];
      const lastRaw = drawing.raw[drawing.raw.length - 1];
      const lastSmooth = path[path.length - 1];
      if (
        lastRaw &&
        (Math.abs(lastRaw.x - lastSmooth.x) > 0.5 ||
          Math.abs(lastRaw.y - lastSmooth.y) > 0.5)
      ) {
        path.push(lastRaw);
      }
      const compacted = simplify(path, 0.6);
      return {
        points: compacted,
        brush: drawing.brush,
        color: drawing.color,
        width: drawing.width,
        opacity: drawing.opacity,
        seed: drawing.seed,
        tool: drawing.brush === "spray" ? "spray" : undefined,
      };
    }

    const start = drawing.raw[0];
    const end = drawing.raw[1] ?? drawing.raw[0];
    if (Math.hypot(end.x - start.x, end.y - start.y) < 1.5) return null;
    return {
      points: shapePoints(drawing.tool, start, end),
      brush: drawing.brush,
      color: drawing.color,
      width: drawing.width,
      opacity: drawing.opacity,
      seed: drawing.seed,
    };
  }

  function pushHistory(snapshot: DrawingStroke[]) {
    setPast((prev) => {
      const next = [...prev, snapshot];
      if (next.length > HISTORY_LIMIT) next.shift();
      return next;
    });
    setFuture([]);
  }

  function clearLiveCanvas() {
    if (liveRef.current) clearCanvas(liveRef.current);
  }

  function repaintCommitted(nextStrokes: DrawingStroke[]) {
    const c = committedRef.current;
    if (!c) return;
    clearCanvas(c);
    const ctx = c.getContext("2d");
    if (ctx) renderScene(ctx, nextStrokes);
  }

  const undo = () => {
    if (past.length === 0) return;
    const last = past[past.length - 1];
    setFuture((f) => [...f, strokes]);
    setStrokes(last);
    setPast((p) => p.slice(0, -1));
    repaintCommitted(last);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setPast((p) => [...p, strokes]);
    setStrokes(next);
    setFuture((f) => f.slice(0, -1));
    repaintCommitted(next);
  };

  const clearAll = () => {
    if (strokes.length === 0) return;
    pushHistory(strokes);
    setStrokes([]);
    repaintCommitted([]);
  };

  const reload = () => {
    setStrokes([]);
    setPast([]);
    setFuture([]);
    drawingRef.current = null;
    if (committedRef.current) clearCanvas(committedRef.current);
    if (liveRef.current) clearCanvas(liveRef.current);
    setLoadError(null);
    void loadChallenge();
  };

  const toggleFullscreen = () => setIsFullscreen((prev) => !prev);

  // Esc exits fullscreen.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  // Lock body scroll while fullscreen.
  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);

  // ── UI ───────────────────────────────────────────────────────────────────

  const cursorStyle = useMemo(() => {
    if (disabled) return "not-allowed";
    if (brushId === "eraser") return "cell";
    return "crosshair";
  }, [disabled, brushId]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="text-sm font-light text-white/40">summoning the council...</p>
      </div>
    );
  }

  if (loadError || !challenge) {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-5">
        <p className="mb-3 text-sm font-light text-rose-100/80">
          {loadError ?? "The council is unreachable."}
        </p>
        <button
          type="button"
          onClick={reload}
          className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-light text-white/70 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white/90"
        >
          try again
        </button>
      </div>
    );
  }

  const containerClass = isFullscreen
    ? "fixed inset-0 z-[100] flex flex-col bg-[#06030c] p-3 sm:p-4"
    : "rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 md:p-4";

  return (
    <div ref={containerRef} className={containerClass}>
      {/* Header strip */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-white/40"
              title={`global trial #${challenge.globalIndex + 1}`}
            >
              tier {challenge.level}/{DRAWING_MAX_LEVEL}
            </span>
            <span className="truncate text-sm font-light text-white/55">
              draw <span className="text-white/95">{challenge.drawingPrompt}</span>
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/55 transition-colors duration-150 hover:border-white/25 hover:text-white/90"
            title={isFullscreen ? "exit fullscreen" : "fullscreen"}
            aria-label={isFullscreen ? "exit fullscreen" : "enter fullscreen"}
          >
            {isFullscreen ? <ShrinkIcon /> : <ExpandIcon />}
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={disabled}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-light text-white/55 transition-colors duration-150 hover:border-white/25 hover:text-white/90 disabled:opacity-40"
          >
            new prompt
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={wrapperRef}
        className={`relative w-full select-none overflow-hidden rounded-xl border border-white/10 shadow-[inset_0_0_60px_rgba(0,0,0,0.4)] ${
          isFullscreen ? "min-h-0 flex-1" : ""
        }`}
        style={{
          aspectRatio: isFullscreen
            ? undefined
            : `${DRAWING_CANVAS_WIDTH} / ${DRAWING_CANVAS_HEIGHT}`,
          backgroundColor: "#0c0816",
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <canvas
          ref={committedRef}
          className="absolute inset-0 h-full w-full"
          width={DRAWING_CANVAS_WIDTH}
          height={DRAWING_CANVAS_HEIGHT}
        />
        <canvas
          ref={liveRef}
          className="absolute inset-0 h-full w-full touch-none"
          width={DRAWING_CANVAS_WIDTH}
          height={DRAWING_CANVAS_HEIGHT}
          onPointerDown={beginStroke}
          onPointerMove={continueStroke}
          onPointerUp={endStroke}
          onPointerLeave={cancelStroke}
          onPointerCancel={cancelStroke}
          onContextMenu={(event) => event.preventDefault()}
          style={{ cursor: cursorStyle, touchAction: "none" }}
        />
      </div>

      {/* Toolbar */}
      <div className="mt-2 space-y-1.5">
        {/* Brush strip — horizontal scroll on narrow screens */}
        <div
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {BRUSH_ORDER.map((id) => {
            const selected = id === brushId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setBrushId(id);
                  if (tool !== "brush") setTool("brush");
                }}
                disabled={disabled}
                aria-pressed={selected}
                title={BRUSH_LABELS[id]}
                className={`group flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 transition-colors duration-150 active:scale-95 disabled:opacity-40 ${
                  selected
                    ? "border-white/40 bg-white/[0.08]"
                    : "border-white/10 hover:border-white/25"
                }`}
              >
                <BrushPreview brush={id} color={color} width={width} />
                <span
                  className={`text-[9px] uppercase tracking-[0.18em] ${
                    selected ? "text-white" : "text-white/55"
                  }`}
                >
                  {BRUSH_LABELS[id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sliders + shapes + actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex min-w-[150px] flex-1 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5">
            <span className="text-[9px] uppercase tracking-[0.18em] text-white/40">
              size
            </span>
            <input
              type="range"
              min={MIN_WIDTH}
              max={MAX_WIDTH}
              step={1}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              disabled={disabled}
              className="flex-1 accent-white/80"
              aria-label="brush size"
            />
            <span className="w-7 text-right text-[10px] tabular-nums text-white/55">
              {width}
            </span>
          </div>

          <div className="flex min-w-[150px] flex-1 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5">
            <span className="text-[9px] uppercase tracking-[0.18em] text-white/40">
              flow
            </span>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={Math.round(opacity * 100)}
              onChange={(e) =>
                setOpacity(Math.max(0.05, Number(e.target.value) / 100))
              }
              disabled={disabled || brushId === "eraser"}
              className="flex-1 accent-white/80 disabled:opacity-40"
              aria-label="opacity"
            />
            <span className="w-7 text-right text-[10px] tabular-nums text-white/55">
              {Math.round(opacity * 100)}
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
            {(["brush", "line", "rect", "ellipse"] as ToolMode[]).map((mode) => {
              const selected = tool === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTool(mode)}
                  disabled={disabled}
                  aria-pressed={selected}
                  title={mode === "brush" ? "freehand" : mode}
                  className={`flex h-7 w-7 items-center justify-center rounded transition-colors duration-150 ${
                    selected
                      ? "bg-white/[0.12] text-white"
                      : "text-white/55 hover:text-white/90"
                  }`}
                >
                  <ShapeIcon mode={mode} />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
            <button
              type="button"
              onClick={undo}
              disabled={disabled || past.length === 0}
              title="undo"
              className="flex h-7 w-7 items-center justify-center rounded text-white/55 transition-colors duration-150 hover:text-white/90 disabled:opacity-30"
            >
              <UndoIcon />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={disabled || future.length === 0}
              title="redo"
              className="flex h-7 w-7 items-center justify-center rounded text-white/55 transition-colors duration-150 hover:text-white/90 disabled:opacity-30"
            >
              <RedoIcon />
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled || strokes.length === 0}
              title="clear canvas"
              className="flex h-7 w-7 items-center justify-center rounded text-white/55 transition-colors duration-150 hover:text-rose-200/90 disabled:opacity-30"
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        {/* Color row */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5">
          <span className="text-[9px] uppercase tracking-[0.18em] text-white/40">
            color
          </span>
          <div className="flex flex-wrap gap-1">
            {COLOR_PRESETS.map((preset) => {
              const selected =
                preset.toLowerCase() === color.toLowerCase() &&
                brushId !== "eraser";
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  disabled={disabled || brushId === "eraser"}
                  aria-label={`color ${preset}`}
                  className="h-6 w-6 rounded-full border transition-transform duration-150 active:scale-90 disabled:opacity-40 sm:hover:scale-110"
                  style={{
                    backgroundColor: preset,
                    borderColor: selected
                      ? "rgba(255,255,255,0.95)"
                      : "rgba(255,255,255,0.15)",
                    boxShadow: selected
                      ? `0 0 0 2px rgba(255,255,255,0.15), 0 0 10px ${preset}66`
                      : undefined,
                  }}
                />
              );
            })}
          </div>
          <label
            className={`relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white/15 ${
              disabled || brushId === "eraser" ? "opacity-40" : "cursor-pointer"
            }`}
            title="custom color"
          >
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "conic-gradient(from 180deg, #f87171, #fbbf24, #34d399, #38bdf8, #a78bfa, #f472b6, #f87171)",
              }}
            />
            <span
              aria-hidden
              className="absolute inset-1 rounded-full"
              style={{ backgroundColor: color }}
            />
            <input
              type="color"
              value={normalizeHex(color)}
              onChange={(event) => setColor(event.target.value)}
              disabled={disabled || brushId === "eraser"}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="custom color"
            />
          </label>

          <span className="ml-auto text-[10px] font-light text-white/35">
            {strokes.length === 0
              ? "blank canvas"
              : `${strokes.length} stroke${strokes.length === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Snapshot composition (debounced; called only on idle) ───────────────────

async function composeSnapshot(
  committed: HTMLCanvasElement | null,
): Promise<string | undefined> {
  if (!committed) return undefined;
  try {
    const w = committed.width;
    const h = committed.height;
    if (w === 0 || h === 0) return undefined;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    if (!ctx) return undefined;
    ctx.fillStyle = "#0c0816";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(committed, 0, 0);
    return out.toDataURL("image/png");
  } catch (error) {
    console.error("Snapshot error:", error);
    return undefined;
  }
}

// ── Shape rasterization ─────────────────────────────────────────────────────

function shapePoints(
  tool: ToolMode,
  start: DrawingPoint,
  end: DrawingPoint,
): DrawingPoint[] {
  if (tool === "line") {
    return [
      { x: start.x, y: start.y, p: 1, t: 0 },
      { x: end.x, y: end.y, p: 1, t: 1 },
    ];
  }
  if (tool === "rect") {
    return [
      { x: start.x, y: start.y, p: 1, t: 0 },
      { x: end.x, y: start.y, p: 1, t: 0 },
      { x: end.x, y: end.y, p: 1, t: 0 },
      { x: start.x, y: end.y, p: 1, t: 0 },
      { x: start.x, y: start.y, p: 1, t: 0 },
    ];
  }
  if (tool === "ellipse") {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    const out: DrawingPoint[] = [];
    for (let i = 0; i <= ELLIPSE_SEGMENTS; i += 1) {
      const angle = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
      out.push({
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
        p: 1,
        t: 0,
      });
    }
    return out;
  }
  return [];
}

// ── Mini brush previews ─────────────────────────────────────────────────────

function BrushPreview({
  brush,
  color,
  width,
}: {
  brush: BrushId;
  color: string;
  width: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const N = 24;
    const points: DrawingPoint[] = [];
    for (let i = 0; i <= N; i += 1) {
      const u = i / N;
      const x = 5 + (W - 10) * u;
      const y = H / 2 + Math.sin(u * Math.PI) * (H / 4);
      const pressure = 0.4 + Math.sin(u * Math.PI) * 0.5;
      points.push({ x, y, p: pressure, t: u * 220 });
    }
    const previewColor = brush === "eraser" ? "#bcbcbc" : color;
    const previewWidth = Math.max(3, Math.min(width, 9));
    renderStroke(ctx, {
      points,
      brush,
      color: previewColor,
      width: previewWidth,
      opacity: 1,
      seed: 7,
      tool: brush === "spray" ? "spray" : undefined,
    });
  }, [brush, color, width]);

  return (
    <canvas
      ref={ref}
      width={48}
      height={16}
      className="block h-4 w-12 rounded bg-[#0c0816]"
    />
  );
}

// ── Utilities ───────────────────────────────────────────────────────────────

function clearCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function clearCanvasPixels(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function normalizeHex(value: string): string {
  if (/^#([0-9a-f]{6})$/i.test(value)) return value;
  if (/^#([0-9a-f]{3})$/i.test(value)) {
    const m = value.slice(1);
    return `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`;
  }
  return "#ffffff";
}

// ── Icons ───────────────────────────────────────────────────────────────────

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ShapeIcon({ mode }: { mode: ToolMode }) {
  if (mode === "brush") {
    return (
      <svg {...ICON_PROPS}>
        <path d="M5 19c2-7 5-12 9-14" />
        <path d="M14 5l3 3" />
      </svg>
    );
  }
  if (mode === "line") {
    return (
      <svg {...ICON_PROPS}>
        <line x1="5" y1="19" x2="19" y2="5" />
      </svg>
    );
  }
  if (mode === "rect") {
    return (
      <svg {...ICON_PROPS}>
        <rect x="5" y="7" width="14" height="10" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg {...ICON_PROPS}>
      <ellipse cx="12" cy="12" rx="7" ry="5" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h9a6 6 0 016 6v1" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9h-9a6 6 0 00-6 6v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </svg>
  );
}

function ShrinkIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 4v5H4" />
      <path d="M15 4v5h5" />
      <path d="M9 20v-5H4" />
      <path d="M15 20v-5h5" />
    </svg>
  );
}
