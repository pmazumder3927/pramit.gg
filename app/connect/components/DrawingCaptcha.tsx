"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cormorant_Garamond } from "next/font/google";

// Distinctive italic serif for the council's voice. Self-contained so the
// rest of the site keeps the Inter rhythm.
const councilSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["italic", "normal"],
  display: "swap",
  variable: "--font-council",
});

import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_MIN_TOTAL_LENGTH,
  type ConfessionalCaptchaChallenge,
  type ConfessionalCaptchaSubmission,
  evaluateDrawing,
} from "@/app/lib/confessional-captcha";
import {
  glyphFontStack,
  type GlyphScript,
} from "@/app/lib/confessional-glyphs";
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

export type DrawingCaptchaHandle = {
  // Synchronously generate a fresh PNG snapshot of the current canvas state.
  // Returns undefined if the canvas isn't mounted or the rasterization fails.
  getSnapshot: () => Promise<string | undefined>;
};

type CaptchaResponse = {
  token: string;
  challenge: ConfessionalCaptchaChallenge;
};

type ToolMode = "brush" | "line" | "rect" | "ellipse";
type PopoverId = "brush" | "color" | "size" | null;

const COLOR_PRESETS = [
  "#f5f5f5",
  "#2a2018",
  "#ff8f6b",
  "#e0922f",
  "#7aa86a",
  "#5e86b8",
  "#8b6fc4",
  "#3fa7a3",
  "#d56a98",
  "#a87bf2",
];

// Canvas surfaces + default ink per theme. Light mode is a warm sketchbook
// paper with dark ink; dark mode keeps the inky offering-tablet feel.
const SURFACE = {
  light: {
    canvas: "#f3ece0",
    ink: "#2a2018",
    grid: "rgba(42,32,24,0.07)",
    vignette: "rgba(120,90,60,0.12)",
  },
  dark: {
    canvas: "#1a1410",
    ink: "#f5f5f5",
    grid: "rgba(255,255,255,0.05)",
    vignette: "rgba(0,0,0,0.55)",
  },
} as const;

type ThemeName = keyof typeof SURFACE;

function readTheme(): ThemeName {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const DEFAULT_BRUSH: BrushId = "pen";
const DEFAULT_COLOR = "#2a2018";
const DEFAULT_WIDTH = 6;
const DEFAULT_OPACITY = 1;
const MIN_WIDTH = 1;
const MAX_WIDTH = 48;
const HISTORY_LIMIT = 50;
const SMOOTHING_ALPHA = 0.45;
const ELLIPSE_SEGMENTS = 48;

const BRUSH_LABELS: Record<BrushId, string> = {
  pen: "pen",
  fineliner: "fineliner",
  pencil: "pencil",
  marker: "marker",
  brush: "brush",
  charcoal: "charcoal",
  watercolor: "wash",
  spray: "spray",
  eraser: "eraser",
};

const TOOL_MODES: ToolMode[] = ["brush", "line", "rect", "ellipse"];
const TOOL_LABELS: Record<ToolMode, string> = {
  brush: "freehand",
  line: "line",
  rect: "rectangle",
  ellipse: "ellipse",
};

// Lang hints help the browser pick the right CJK shaping; the font stack is set
// explicitly either way. All hanzi we ship are simplified forms (the brush face
// is simplified-only).
const GLYPH_LANG: Record<GlyphScript, string> = {
  chinese: "zh-Hans",
  japanese: "ja",
  egyptian: "",
};


const DrawingCaptcha = forwardRef<DrawingCaptchaHandle, DrawingCaptchaProps>(
  function DrawingCaptcha(
    { disabled = false, refreshKey = 0, onChange }: DrawingCaptchaProps,
    ref,
  ) {
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

  const strokesRef = useRef<DrawingStroke[]>(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

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
  const [popover, setPopover] = useState<PopoverId>(null);

  // Theme — drives the canvas surface + default ink so the tool reads against
  // whatever paper it's sitting on. Re-read on mount and whenever the html
  // `.dark` class flips.
  const [theme, setTheme] = useState<ThemeName>("dark");
  const surface = SURFACE[theme];
  // Track whether the user has hand-picked a color; if not, the default ink
  // follows the theme so it always contrasts the surface.
  const colorTouchedRef = useRef(false);
  useEffect(() => {
    const sync = () => {
      const next = readTheme();
      setTheme(next);
      if (!colorTouchedRef.current) {
        setColor(SURFACE[next].ink);
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const handleColorChange = useCallback((value: string) => {
    colorTouchedRef.current = true;
    setColor(value);
  }, []);

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

  // Glyph-inscription challenges show the target character as a reference + a
  // faint tracing ghost behind the canvas, instead of a freeform prompt.
  const glyph = challenge?.kind === "glyph" ? challenge.glyph ?? null : null;

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

  useEffect(() => {
    setStrokes([]);
    setPast([]);
    setFuture([]);
    drawingRef.current = null;
    if (committedRef.current) clearCanvas(committedRef.current);
    if (liveRef.current) clearCanvas(liveRef.current);
    void loadChallenge();
  }, [loadChallenge, refreshKey]);

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

  // Bump the resize observer when fullscreen toggles by reading layout
  // on the next frame.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      wrapper.getBoundingClientRect();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isFullscreen]);

  // Surface readiness to the parent on every stroke change. We do NOT bake
  // the snapshot into this payload — the parent calls getSnapshot() via the
  // imperative ref at submit time so it always gets a fresh raster.
  useEffect(() => {
    if (!ready || !challenge) {
      onChangeRef.current(null, false);
      return;
    }
    onChangeRef.current({ token, strokes }, true);
  }, [challenge, ready, strokes, token]);

  useImperativeHandle(
    ref,
    () => ({
      getSnapshot: async () => composeSnapshot(committedRef.current),
    }),
    [],
  );

  // ── Pointer flow ─────────────────────────────────────────────────────────

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !liveRef.current) return;
    if (popover) setPopover(null);
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

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const last = prevPast[prevPast.length - 1];
      setFuture((f) => [...f, strokesRef.current]);
      setStrokes(last);
      repaintCommitted(last);
      return prevPast.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[prevFuture.length - 1];
      setPast((p) => [...p, strokesRef.current]);
      setStrokes(next);
      repaintCommitted(next);
      return prevFuture.slice(0, -1);
    });
  }, []);

  const clearAll = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    pushHistory(strokesRef.current);
    setStrokes([]);
    repaintCommitted([]);
  }, []);

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

  // Esc closes popover or exits fullscreen.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (popover) {
          setPopover(null);
          return;
        }
        if (isFullscreen) setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, popover]);

  // Lock body scroll while fullscreen.
  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);

  // Keyboard shortcuts (desktop). Skip if typing in a real input.
  useEffect(() => {
    if (disabled) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === "y" && meta) {
        event.preventDefault();
        redo();
        return;
      }
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      switch (event.key.toLowerCase()) {
        case "b":
          setTool("brush");
          break;
        case "l":
          setTool("line");
          break;
        case "r":
          setTool("rect");
          break;
        case "o":
          setTool("ellipse");
          break;
        case "e":
          setBrushId("eraser");
          setTool("brush");
          break;
        case "[":
          setWidth((w) => Math.max(MIN_WIDTH, w - 1));
          break;
        case "]":
          setWidth((w) => Math.min(MAX_WIDTH, w + 1));
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [disabled, undo, redo]);

  // ── UI ───────────────────────────────────────────────────────────────────

  const cursorStyle = useMemo(() => {
    if (disabled) return "not-allowed";
    if (brushId === "eraser") return "cell";
    return "crosshair";
  }, [disabled, brushId]);

  if (isLoading) {
    return (
      <div className="rounded-xl border-[1.4px] border-dashed border-line bg-card p-6">
        <p
          className={`${councilSerif.className} text-base italic text-ink-faint`}
        >
          summoning the council...
        </p>
      </div>
    );
  }

  if (loadError || !challenge) {
    return (
      <div className="rounded-xl border-[1.4px] border-accent-rust/40 bg-accent-rust/10 p-5">
        <p className="mb-3 text-sm text-accent-rust">
          {loadError ?? "The council is unreachable."}
        </p>
        <button
          type="button"
          onClick={reload}
          className="rounded-xl border-[1.4px] border-line bg-paper-2/50 px-4 py-2 text-sm text-ink-soft transition-colors duration-300 hover:border-accent-orange/60 hover:text-ink"
        >
          try again
        </button>
      </div>
    );
  }

  const containerClass = isFullscreen
    ? "fixed inset-0 z-[100] flex min-h-0 flex-col bg-paper/95 p-3 text-ink backdrop-blur-xl sm:p-6"
    : "text-ink";

  return (
    <div className={containerClass}>
      <div
        className={
          isFullscreen
            ? "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-[1.6px] border-line bg-card shadow-paper-lg"
            : "relative flex min-h-0 flex-col overflow-hidden rounded-xl border-[1.6px] border-line bg-card"
        }
      >
        {/* Header — the council's request, in mystical voice */}
        <header className="relative flex shrink-0 items-start justify-between gap-4 px-5 pb-2.5 pt-4 sm:px-6 sm:pt-5">
          {glyph ? (
            <div className="flex min-w-0 flex-col gap-1">
              <p
                className={`${councilSerif.className} flex items-center gap-2 text-sm italic text-ink-soft sm:text-base`}
                style={{ fontWeight: 300 }}
              >
                <span className="font-sans text-[10px] not-italic uppercase tracking-[0.36em] text-ink-faint">
                  inscription {romanize(challenge.level)}
                </span>
                <span aria-hidden className="text-ink-faint/60">
                  ·
                </span>
                <span className="truncate">{glyph.scriptLabel}</span>
              </p>
              <h3
                className={`${councilSerif.className} flex min-w-0 items-baseline gap-3 text-ink`}
                style={{ fontWeight: 400 }}
              >
                <span
                  aria-hidden
                  className="text-base leading-none text-accent-orange/80"
                >
                  ✦
                </span>
                <span
                  lang={GLYPH_LANG[glyph.script] || undefined}
                  className="shrink-0 text-4xl not-italic leading-none text-ink sm:text-5xl"
                  style={{ fontFamily: glyphFontStack(glyph.script) }}
                >
                  {glyph.glyph}
                </span>
                <span className="min-w-0 truncate text-xl italic tracking-tight text-ink-soft sm:text-2xl">
                  “{glyph.meaning}”
                  {glyph.romanization ? (
                    <span className="ml-2 font-sans text-[11px] not-italic uppercase tracking-[0.2em] text-ink-faint">
                      {glyph.romanization}
                    </span>
                  ) : null}
                </span>
              </h3>
              <p className="mt-0.5 max-w-prose font-serif text-xs italic text-ink-faint">
                reproduce the character — {glyph.shapeHint}
              </p>
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-1">
              <p
                className={`${councilSerif.className} flex items-center gap-2 text-sm italic text-ink-soft sm:text-base`}
                style={{ fontWeight: 300 }}
              >
                <span className="font-sans text-[10px] not-italic uppercase tracking-[0.36em] text-ink-faint">
                  edict {romanize(challenge.level)}
                </span>
                <span aria-hidden className="text-ink-faint/60">
                  ·
                </span>
                <span className="truncate">
                  the council implores you to draw
                </span>
              </p>
              <h3
                className={`${councilSerif.className} flex items-baseline gap-2.5 truncate text-ink`}
                style={{ fontWeight: 400 }}
              >
                <span
                  aria-hidden
                  className="text-base leading-none text-accent-orange/80"
                >
                  ✦
                </span>
                <span className="truncate text-2xl italic tracking-tight sm:text-3xl">
                  {challenge.drawingPrompt}
                </span>
              </h3>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <div className="hidden sm:block">
              <StatusSigil ready={ready} />
            </div>
            <div className="flex items-center gap-1">
              <HeaderIcon
                label={isFullscreen ? "exit fullscreen" : "enter fullscreen"}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <ShrinkIcon /> : <ExpandIcon />}
              </HeaderIcon>
              <HeaderIcon
                label="new prompt"
                onClick={reload}
                disabled={disabled}
              >
                <RefreshIcon />
              </HeaderIcon>
            </div>
          </div>
        </header>

        {/* Ornamental rule with center sigil — separates the council's voice
            from the offering tablet below */}
        <div
          aria-hidden
          className="relative mx-5 mb-2 flex items-center gap-2 sm:mx-6"
        >
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-transparent" />
          <span className="text-[10px] tracking-[0.4em] text-ink-faint/70">◆</span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-transparent" />
        </div>

        {/* Canvas — the offering tablet */}
        <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-4 sm:pb-4">
          <div
            ref={wrapperRef}
            className="relative w-full select-none overflow-hidden rounded-xl border border-line"
            style={{
              aspectRatio: isFullscreen
                ? undefined
                : `${DRAWING_CANVAS_WIDTH} / ${DRAWING_CANVAS_HEIGHT}`,
              flex: isFullscreen ? "1 1 auto" : undefined,
              backgroundColor: surface.canvas,
              backgroundImage: `radial-gradient(circle at 1px 1px, ${surface.grid} 1px, transparent 0)`,
              backgroundSize: "22px 22px",
            }}
          >
            {/* Vignette so the dot grid feels like a surface */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at center, transparent 55%, ${surface.vignette} 100%)`,
              }}
            />

            {/* Ember glow — appears when the offering meets the council's
                requirement. Soft, slow pulse. */}
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-700 ${
                ready ? "opacity-100" : "opacity-0"
              }`}
              style={{
                boxShadow:
                  "inset 0 0 60px rgba(255,107,61,0.18), inset 0 0 120px rgba(255,107,61,0.08)",
              }}
            />
            {ready ? (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{
                  boxShadow:
                    "inset 0 0 80px rgba(255,107,61,0.22)",
                }}
                animate={{ opacity: [0.6, 0.95, 0.6] }}
                transition={{
                  duration: 3.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ) : null}

            {/* Corner sigils — mark the sacred space */}
            <CornerGlyph position="tl" />
            <CornerGlyph position="tr" />
            <CornerGlyph position="bl" />
            <CornerGlyph position="br" />

            {/* Mobile status sigil — header version is hidden below sm */}
            <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 sm:hidden">
              <StatusSigil ready={ready} />
            </div>

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

            {strokes.length === 0 ? (
              <motion.div
                className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.55, 0.95, 0.55] }}
                transition={{
                  duration: 4.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <div
                  className={`${councilSerif.className} text-base italic tracking-wide text-ink-faint sm:text-lg`}
                >
                  {glyph ? "reproduce it from memory" : "make your offering"}
                </div>
              </motion.div>
            ) : null}

            {/* Floating toolbar — overlays the canvas at the bottom-center,
                like a brass instrument case resting on the altar */}
            <Toolbar
              tool={tool}
              brushId={brushId}
              color={color}
              width={width}
              opacity={opacity}
              disabled={disabled}
              canUndo={past.length > 0}
              canRedo={future.length > 0}
              canClear={strokes.length > 0}
              popover={popover}
              onPopover={setPopover}
              onTool={(next) => {
                setTool(next);
                if (next !== "brush" && brushId === "eraser") {
                  setBrushId(DEFAULT_BRUSH);
                }
              }}
              onBrush={(id) => {
                setBrushId(id);
                if (tool !== "brush") setTool("brush");
              }}
              onColor={handleColorChange}
              onWidth={setWidth}
              onOpacity={setOpacity}
              onUndo={undo}
              onRedo={redo}
              onClear={clearAll}
            />
          </div>
        </div>
      </div>
    </div>
  );
  },
);

export default DrawingCaptcha;

function CornerGlyph({
  position,
}: {
  position: "tl" | "tr" | "bl" | "br";
}) {
  const placement: Record<typeof position, string> = {
    tl: "left-2 top-2",
    tr: "right-2 top-2",
    bl: "left-2 bottom-2",
    br: "right-2 bottom-2",
  };
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-20 select-none text-[10px] leading-none text-ink-faint/50 ${placement[position]}`}
    >
      ✦
    </span>
  );
}

function StatusSigil({ ready }: { ready: boolean }) {
  return (
    <div
      className={`${councilSerif.className} flex items-center gap-2 rounded-full border px-3 py-1 text-xs italic backdrop-blur-md transition-colors duration-500 ${
        ready
          ? "border-accent-orange/40 bg-accent-orange/10 text-accent-orange"
          : "border-line bg-paper-2/70 text-ink-faint"
      }`}
      style={{ fontWeight: 400 }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {ready ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-accent-orange/60" />
        ) : null}
        <span
          className={`relative inline-block h-1.5 w-1.5 rounded-full ${
            ready ? "bg-accent-orange" : "bg-ink-faint/60"
          }`}
        />
      </span>
      <span>{ready ? "ready to be judged" : "awaiting offering"}</span>
    </div>
  );
}

function romanize(value: number): string {
  const numerals: [number, string][] = [
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let result = "";
  let remaining = value;
  for (const [n, glyph] of numerals) {
    while (remaining >= n) {
      result += glyph;
      remaining -= n;
    }
  }
  return result || "i";
}

// ── Toolbar ─────────────────────────────────────────────────────────────────

type ToolbarProps = {
  tool: ToolMode;
  brushId: BrushId;
  color: string;
  width: number;
  opacity: number;
  disabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  popover: PopoverId;
  onPopover: (id: PopoverId) => void;
  onTool: (mode: ToolMode) => void;
  onBrush: (id: BrushId) => void;
  onColor: (value: string) => void;
  onWidth: (value: number) => void;
  onOpacity: (value: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
};

function Toolbar({
  tool,
  brushId,
  color,
  width,
  opacity,
  disabled,
  canUndo,
  canRedo,
  canClear,
  popover,
  onPopover,
  onTool,
  onBrush,
  onColor,
  onWidth,
  onOpacity,
  onUndo,
  onRedo,
  onClear,
}: ToolbarProps) {
  const togglePopover = (id: Exclude<PopoverId, null>) => {
    onPopover(popover === id ? null : id);
  };

  return (
    <div className="absolute inset-x-2 bottom-2 z-30 flex justify-center sm:bottom-3">
      <div className="relative max-w-full overflow-visible rounded-full border border-line bg-card/85 p-1 shadow-paper backdrop-blur-xl">
        {/* Click-catcher: closes popover when tapping the toolbar background */}
        {popover ? (
          <button
            type="button"
            aria-label="close panel"
            onClick={() => onPopover(null)}
            className="absolute inset-0 z-0 cursor-default rounded-full"
            tabIndex={-1}
          />
        ) : null}

        <div className="relative z-10 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1.5">
        <ToolGroup>
          {TOOL_MODES.map((mode) => (
            <IconBtn
              key={mode}
              label={TOOL_LABELS[mode]}
              active={tool === mode && brushId !== "eraser"}
              onClick={() => onTool(mode)}
              disabled={disabled}
            >
              <ShapeIcon mode={mode} />
            </IconBtn>
          ))}
        </ToolGroup>

        <Divider />

        <ToolGroup>
          <PopoverButton
            label={`brush · ${BRUSH_LABELS[brushId]}`}
            open={popover === "brush"}
            onClick={() => togglePopover("brush")}
            disabled={disabled}
          >
            <BrushDot brushId={brushId} color={color} />
            <span className="hidden text-[11px] font-light text-ink-soft sm:inline">
              {BRUSH_LABELS[brushId]}
            </span>
            <Caret />
          </PopoverButton>

          <PopoverButton
            label="color"
            open={popover === "color"}
            onClick={() => togglePopover("color")}
            disabled={disabled || brushId === "eraser"}
          >
            <span
              className="block h-3.5 w-3.5 rounded-full ring-1 ring-line"
              style={{
                background:
                  brushId === "eraser"
                    ? "repeating-linear-gradient(45deg, rgb(var(--fg) / 0.18) 0 2px, transparent 2px 4px)"
                    : color,
              }}
            />
            <Caret />
          </PopoverButton>

          <PopoverButton
            label={`size ${width}px`}
            open={popover === "size"}
            onClick={() => togglePopover("size")}
            disabled={disabled}
          >
            <span
              className="block rounded-full bg-ink/80"
              style={{
                width: `${Math.max(3, Math.min(width / 2, 14))}px`,
                height: `${Math.max(3, Math.min(width / 2, 14))}px`,
              }}
            />
            <span className="hidden text-[11px] tabular-nums font-light text-ink-soft sm:inline">
              {width}
            </span>
            <Caret />
          </PopoverButton>
        </ToolGroup>

        <Divider />

        <ToolGroup>
          <IconBtn
            label="undo"
            onClick={onUndo}
            disabled={disabled || !canUndo}
            shortcut="⌘Z"
          >
            <UndoIcon />
          </IconBtn>
          <IconBtn
            label="redo"
            onClick={onRedo}
            disabled={disabled || !canRedo}
            shortcut="⇧⌘Z"
          >
            <RedoIcon />
          </IconBtn>
          <IconBtn
            label="clear"
            onClick={onClear}
            disabled={disabled || !canClear}
            danger
          >
            <TrashIcon />
          </IconBtn>
        </ToolGroup>
        </div>

        {/* Popovers — rendered above the pill, anchored to its center */}
        <AnimatePresence>
          {popover === "brush" ? (
            <PopoverShell key="brush-pop">
              <BrushPanel
                brushId={brushId}
                color={color}
                width={width}
                onSelect={(id) => {
                  onBrush(id);
                }}
              />
            </PopoverShell>
          ) : null}
          {popover === "color" ? (
            <PopoverShell key="color-pop">
              <ColorPanel color={color} onSelect={onColor} />
            </PopoverShell>
          ) : null}
          {popover === "size" ? (
            <PopoverShell key="size-pop">
              <SizePanel
                width={width}
                opacity={opacity}
                brushId={brushId}
                color={color}
                onWidth={onWidth}
                onOpacity={onOpacity}
              />
            </PopoverShell>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">{children}</div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="mx-0.5 h-5 w-px shrink-0 bg-line sm:mx-1"
    />
  );
}

function Caret() {
  return (
    <svg
      width={9}
      height={9}
      viewBox="0 0 10 10"
      className="shrink-0 text-ink-faint"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4l2.5 2.5L7.5 4" />
    </svg>
  );
}

function PopoverShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 -translate-x-1/2"
    >
      <div className="relative overflow-hidden rounded-2xl border border-line bg-card/95 shadow-paper-lg backdrop-blur-2xl">
        {/* Inner ember ring — ties popovers to the editor's accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            boxShadow: "inset 0 0 0 1px rgba(255,107,61,0.06)",
          }}
        />
        {children}
      </div>
    </motion.div>
  );
}

// ── Brush panel ─────────────────────────────────────────────────────────────

function BrushPanel({
  brushId,
  color,
  width,
  onSelect,
}: {
  brushId: BrushId;
  color: string;
  width: number;
  onSelect: (id: BrushId) => void;
}) {
  return (
    <div className="w-[300px] p-2 sm:w-[340px]">
      <div className="grid grid-cols-3 gap-1.5">
        {BRUSH_ORDER.map((id) => {
          const selected = id === brushId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-pressed={selected}
              className={`group flex flex-col items-stretch gap-1.5 rounded-xl border px-2 py-2 text-left transition-colors duration-150 ${
                selected
                  ? "border-accent-orange/40 bg-accent-orange/[0.08]"
                  : "border-line bg-paper-2/40 hover:border-ink-faint/40 hover:bg-paper-2/70"
              }`}
            >
              <BrushPreview brush={id} color={color} width={width} />
              <span
                className={`text-[10px] font-light leading-none ${
                  selected ? "text-ink" : "text-ink-soft"
                }`}
              >
                {BRUSH_LABELS[id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Color panel ─────────────────────────────────────────────────────────────

function ColorPanel({
  color,
  onSelect,
}: {
  color: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="w-[260px] p-3">
      <div className="grid grid-cols-5 gap-1.5">
        {COLOR_PRESETS.map((preset) => {
          const selected = preset.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onSelect(preset)}
              aria-label={`color ${preset}`}
              className="relative h-9 w-full rounded-lg transition-transform duration-150 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: preset,
                boxShadow: selected
                  ? `0 0 0 2px rgb(var(--accent-orange)), 0 0 14px ${preset}77`
                  : "inset 0 0 0 1px rgb(var(--line))",
              }}
            />
          );
        })}
      </div>
      <label className="mt-2.5 flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper-2/40 px-2.5 py-2 transition-colors hover:bg-paper-2/70">
        <span
          aria-hidden
          className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-line"
        >
          <span
            className="absolute inset-0"
            style={{
              background:
                "conic-gradient(from 180deg, #f87171, #fbbf24, #34d399, #38bdf8, #a78bfa, #f472b6, #f87171)",
            }}
          />
          <span
            className="absolute inset-1 rounded"
            style={{ backgroundColor: color }}
          />
        </span>
        <span className="flex-1 text-xs font-light text-ink-soft">
          custom color
        </span>
        <span className="text-[11px] tabular-nums text-ink-faint">
          {normalizeHex(color)}
        </span>
        <input
          type="color"
          value={normalizeHex(color)}
          onChange={(event) => onSelect(event.target.value)}
          className="absolute h-0 w-0 opacity-0"
          aria-label="custom color"
        />
      </label>
    </div>
  );
}

// ── Size panel ──────────────────────────────────────────────────────────────

function SizePanel({
  width,
  opacity,
  brushId,
  color,
  onWidth,
  onOpacity,
}: {
  width: number;
  opacity: number;
  brushId: BrushId;
  color: string;
  onWidth: (value: number) => void;
  onOpacity: (value: number) => void;
}) {
  return (
    <div className="w-[260px] p-3">
      <div className="mb-3 flex justify-center overflow-hidden rounded-lg border border-line bg-paper-2/40 p-1.5">
        <BrushPreview brush={brushId} color={color} width={width} large />
      </div>
      <SliderRow
        label="size"
        value={width}
        min={MIN_WIDTH}
        max={MAX_WIDTH}
        unit="px"
        onChange={onWidth}
      />
      <SliderRow
        label="flow"
        value={Math.round(opacity * 100)}
        min={5}
        max={100}
        unit="%"
        disabled={brushId === "eraser"}
        onChange={(value) => onOpacity(Math.max(0.05, value / 100))}
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[11px] font-light text-ink-faint">
        <span>{label}</span>
        <span className="tabular-nums text-ink-soft">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--accent-orange))] disabled:opacity-40"
        aria-label={label}
      />
    </div>
  );
}

// ── Buttons / atoms ─────────────────────────────────────────────────────────

function IconBtn({
  label,
  shortcut,
  active,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 active:scale-90 disabled:opacity-30 ${
        active
          ? "bg-accent-orange/15 text-accent-orange shadow-[inset_0_0_0_1px_rgba(255,107,61,0.4)]"
          : danger
            ? "text-ink-soft hover:bg-accent-rust/15 hover:text-accent-rust"
            : "text-ink-soft hover:bg-paper-2/70 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function PopoverButton({
  label,
  open,
  onClick,
  disabled,
  children,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={open}
      className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 transition-colors duration-150 active:scale-95 disabled:opacity-30 ${
        open
          ? "bg-paper-2/80 text-ink shadow-[inset_0_0_0_1px_rgb(var(--line))]"
          : "text-ink-soft hover:bg-paper-2/70 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function HeaderIcon({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-150 active:scale-90 hover:bg-paper-2/70 hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function BrushDot({ brushId, color }: { brushId: BrushId; color: string }) {
  if (brushId === "eraser") {
    return (
      <span
        className="block h-3.5 w-3.5 rounded-full"
        style={{
          background:
            "repeating-linear-gradient(45deg, rgb(var(--fg) / 0.2) 0 2px, transparent 2px 4px)",
          boxShadow: "inset 0 0 0 1px rgb(var(--line))",
        }}
      />
    );
  }
  return (
    <span
      className="block h-3.5 w-3.5 rounded-full"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}66, inset 0 0 0 1px rgba(255,255,255,0.1)`,
      }}
    />
  );
}

// ── Snapshot composition ────────────────────────────────────────────────────

async function composeSnapshot(
  committed: HTMLCanvasElement | null,
): Promise<string | undefined> {
  if (!committed) return undefined;
  try {
    if (committed.width === 0 || committed.height === 0) return undefined;
    // Export with the committed canvas's native alpha. We deliberately do NOT
    // fill a background — the gallery card and editor share the same page
    // palette but render on slightly different shades, so a baked-in fill
    // reads as a mismatched rectangle. Letting the gallery's own bg show
    // through preserves stroke transparency wherever the snapshot ends up.
    return committed.toDataURL("image/png");
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

// ── Brush preview ───────────────────────────────────────────────────────────

function BrushPreview({
  brush,
  color,
  width,
  large = false,
}: {
  brush: BrushId;
  color: string;
  width: number;
  large?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const theme = readTheme();
  const surface = SURFACE[theme];
  const W = large ? 220 : 80;
  const H = large ? 36 : 22;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const N = 28;
    const points: DrawingPoint[] = [];
    for (let i = 0; i <= N; i += 1) {
      const u = i / N;
      const x = 6 + (W - 12) * u;
      const y = H / 2 + Math.sin(u * Math.PI) * (H / 4);
      const pressure = 0.4 + Math.sin(u * Math.PI) * 0.5;
      points.push({ x, y, p: pressure, t: u * 240 });
    }
    // Eraser preview shows as a "hole" — mid-grey that reads on either surface.
    const previewColor =
      brush === "eraser" ? (theme === "light" ? "#c9bba8" : "#6b5f54") : color;
    const previewWidth = large
      ? Math.max(3, Math.min(width, 14))
      : Math.max(2, Math.min(width, 8));
    renderStroke(ctx, {
      points,
      brush,
      color: previewColor,
      width: previewWidth,
      opacity: 1,
      seed: 7,
      tool: brush === "spray" ? "spray" : undefined,
    });
  }, [brush, color, width, W, H, large, theme]);

  return (
    <canvas
      ref={ref}
      className="block rounded"
      style={{ width: W, height: H, backgroundColor: surface.canvas }}
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

function RefreshIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M18.4 9A7 7 0 006.6 6.6L4 9" />
      <path d="M5.6 15a7 7 0 0011.8 2.4L20 15" />
    </svg>
  );
}
