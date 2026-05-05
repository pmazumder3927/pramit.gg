"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_MAX_LEVEL,
  type ConfessionalCaptchaChallenge,
  type ConfessionalCaptchaSubmission,
  type DrawingPoint,
  type DrawingStroke,
  evaluateDrawing,
} from "@/app/lib/confessional-captcha";

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

type DrawingTool =
  | "pen"
  | "marker"
  | "eraser"
  | "spray"
  | "line"
  | "rect"
  | "ellipse";

const TOOL_DEFS: { id: DrawingTool; label: string }[] = [
  { id: "pen", label: "pen" },
  { id: "marker", label: "marker" },
  { id: "eraser", label: "eraser" },
  { id: "spray", label: "spray" },
  { id: "line", label: "line" },
  { id: "rect", label: "rect" },
  { id: "ellipse", label: "circle" },
];

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

const DEFAULT_TOOL: DrawingTool = "pen";
const DEFAULT_COLOR = COLOR_PRESETS[0];
const DEFAULT_WIDTH = 5;
const DEFAULT_OPACITY = 1;
const MIN_WIDTH = 1;
const MAX_WIDTH = 36;

const SPRAY_RADIUS_MULT = 2.4;
const SPRAY_DOTS_PER_TICK = 7;
const ERASER_SCALE = 2.6;
const ELLIPSE_SEGMENTS = 36;
const HISTORY_LIMIT = 50;

export default function DrawingCaptcha({
  disabled = false,
  refreshKey = 0,
  onChange,
}: DrawingCaptchaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [challengeResponse, setChallengeResponse] =
    useState<CaptchaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [past, setPast] = useState<DrawingStroke[][]>([]);
  const [future, setFuture] = useState<DrawingStroke[][]>([]);

  const [tool, setTool] = useState<DrawingTool>(DEFAULT_TOOL);
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [brushWidth, setBrushWidth] = useState<number>(DEFAULT_WIDTH);
  const [opacity, setOpacity] = useState<number>(DEFAULT_OPACITY);

  const [activePointerId, setActivePointerId] = useState<number | null>(null);
  const [livePoints, setLivePoints] = useState<DrawingPoint[]>([]);
  const [cursor, setCursor] = useState<DrawingPoint | null>(null);

  const livePointsRef = useRef<DrawingPoint[]>([]);
  const dragStartRef = useRef<DrawingPoint | null>(null);
  const eraserBaselineRef = useRef<DrawingStroke[] | null>(null);

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

      if (!response.ok) {
        throw new Error("Could not load the challenge.");
      }

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
    setLivePoints([]);
    livePointsRef.current = [];
    dragStartRef.current = null;
    eraserBaselineRef.current = null;
    setActivePointerId(null);
    void loadChallenge();
  }, [loadChallenge, refreshKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const targetWidth = Math.round(DRAWING_CANVAS_WIDTH * dpr);
    const targetHeight = Math.round(DRAWING_CANVAS_HEIGHT * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    paintScene(context, {
      strokes,
      tool,
      color,
      width: brushWidth,
      opacity,
      livePoints,
      cursor,
      isDrawing: activePointerId !== null,
    });
  }, [
    strokes,
    livePoints,
    cursor,
    tool,
    color,
    brushWidth,
    opacity,
    activePointerId,
  ]);

  useEffect(() => {
    if (!ready || !challenge) {
      onChange(null, false);
      return;
    }

    onChange({ token, strokes }, true);
  }, [challenge, onChange, ready, strokes, token]);

  const pushHistory = useCallback((snapshot: DrawingStroke[]) => {
    setPast((prev) => {
      const next = [...prev, snapshot];
      if (next.length > HISTORY_LIMIT) next.shift();
      return next;
    });
    setFuture([]);
  }, []);

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const point = getCanvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setActivePointerId(event.pointerId);
    dragStartRef.current = point;

    if (tool === "eraser") {
      eraserBaselineRef.current = strokes;
      pushHistory(strokes);
      const eraserRadius = (brushWidth * ERASER_SCALE) / 2;
      const next = applyEraser(strokes, [point], eraserRadius);
      livePointsRef.current = [point];
      setLivePoints([point]);
      setStrokes(next);
      return;
    }

    if (tool === "spray") {
      const dots = scatterDots(point, brushWidth);
      livePointsRef.current = dots;
      setLivePoints(dots);
      return;
    }

    livePointsRef.current = [point];
    setLivePoints([point]);
  };

  const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const cursorPoint = getCanvasPoint(event);
    setCursor(cursorPoint);

    if (activePointerId !== event.pointerId) return;

    if (tool === "eraser") {
      const baseline = eraserBaselineRef.current ?? strokes;
      const path = [...livePointsRef.current, cursorPoint];
      livePointsRef.current = path;
      setLivePoints(path);
      const eraserRadius = (brushWidth * ERASER_SCALE) / 2;
      setStrokes(applyEraser(baseline, path, eraserRadius));
      return;
    }

    if (tool === "spray") {
      const newDots = scatterDots(cursorPoint, brushWidth);
      const merged = [...livePointsRef.current, ...newDots];
      livePointsRef.current = merged;
      setLivePoints(merged);
      return;
    }

    if (tool === "line" || tool === "rect" || tool === "ellipse") {
      const start = dragStartRef.current ?? cursorPoint;
      livePointsRef.current = [start, cursorPoint];
      setLivePoints([start, cursorPoint]);
      return;
    }

    // pen / marker — accumulate points along the path
    const last = livePointsRef.current[livePointsRef.current.length - 1];
    if (last && distance(last, cursorPoint) < 0.6) return;
    const next = [...livePointsRef.current, cursorPoint];
    livePointsRef.current = next;
    setLivePoints(next);
  };

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setActivePointerId(null);

    const path = livePointsRef.current;
    livePointsRef.current = [];
    setLivePoints([]);

    if (path.length === 0) {
      dragStartRef.current = null;
      return;
    }

    if (tool === "eraser") {
      eraserBaselineRef.current = null;
      dragStartRef.current = null;
      return;
    }

    pushHistory(strokes);

    if (tool === "spray") {
      const stroke: DrawingStroke = {
        points: path,
        color,
        width: Math.max(1, Math.round(brushWidth * 0.45)),
        opacity,
        tool: "spray",
      };
      setStrokes((prev) => [...prev, stroke]);
    } else if (tool === "line") {
      const start = dragStartRef.current ?? path[0];
      const end = path[path.length - 1];
      setStrokes((prev) => [
        ...prev,
        {
          points: [start, end],
          color,
          width: brushWidth,
          opacity,
        },
      ]);
    } else if (tool === "rect") {
      const start = dragStartRef.current ?? path[0];
      const end = path[path.length - 1];
      setStrokes((prev) => [
        ...prev,
        {
          points: rectPolyline(start, end),
          color,
          width: brushWidth,
          opacity,
        },
      ]);
    } else if (tool === "ellipse") {
      const start = dragStartRef.current ?? path[0];
      const end = path[path.length - 1];
      setStrokes((prev) => [
        ...prev,
        {
          points: ellipsePolyline(start, end, ELLIPSE_SEGMENTS),
          color,
          width: brushWidth,
          opacity,
        },
      ]);
    } else if (tool === "marker") {
      setStrokes((prev) => [
        ...prev,
        {
          points: path,
          color,
          width: Math.max(brushWidth * 1.6, 6),
          opacity: Math.min(opacity, 0.55),
        },
      ]);
    } else {
      // pen
      setStrokes((prev) => [
        ...prev,
        {
          points: path,
          color,
          width: brushWidth,
          opacity,
        },
      ]);
    }

    dragStartRef.current = null;
  };

  const undo = () => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const last = prevPast[prevPast.length - 1];
      setFuture((f) => [...f, strokes]);
      setStrokes(last);
      return prevPast.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const last = prevFuture[prevFuture.length - 1];
      setPast((p) => [...p, strokes]);
      setStrokes(last);
      return prevFuture.slice(0, -1);
    });
  };

  const clearDrawing = () => {
    if (strokes.length === 0 && livePoints.length === 0) return;
    pushHistory(strokes);
    setStrokes([]);
    livePointsRef.current = [];
    setLivePoints([]);
  };

  const reload = () => {
    setStrokes([]);
    setPast([]);
    setFuture([]);
    setLivePoints([]);
    livePointsRef.current = [];
    dragStartRef.current = null;
    eraserBaselineRef.current = null;
    setActivePointerId(null);
    setLoadError(null);
    void loadChallenge();
  };

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const cursorStyle = useMemo(() => {
    if (disabled) return "not-allowed";
    if (tool === "eraser") return "cell";
    if (tool === "line" || tool === "rect" || tool === "ellipse") return "crosshair";
    return "crosshair";
  }, [disabled, tool]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="text-sm font-light text-white/40">
          summoning the council...
        </p>
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

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/30">
              the council asks
            </p>
            <span
              className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-white/40"
              title={`global trial #${challenge.globalIndex + 1} · the prompts get harder as more drawings are submitted`}
            >
              tier {challenge.level}/{DRAWING_MAX_LEVEL} · {challenge.levelLabel}
            </span>
          </div>
          <h3 className="mt-1 text-xl md:text-2xl font-extralight text-white/90">
            draw <span className="text-white">{challenge.drawingPrompt}</span>
          </h3>
          <p className="mt-1 text-xs font-light text-white/40">
            {challenge.level >= 4
              ? "the council expects ambition. capture the spirit — every detail need not be perfect."
              : "any sincere attempt is fine. take your time."}
          </p>
        </div>

        <button
          type="button"
          onClick={reload}
          disabled={disabled}
          className="self-start rounded-xl border border-white/10 px-3 py-2 text-xs font-light text-white/50 transition-colors duration-300 hover:border-white/20 hover:text-white/80 disabled:opacity-40"
        >
          new prompt
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
        {TOOL_DEFS.map(({ id, label }) => {
          const selected = tool === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              disabled={disabled}
              aria-label={label}
              aria-pressed={selected}
              title={label}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-150 active:scale-95 disabled:opacity-40 ${
                selected
                  ? "border-white/40 bg-white/[0.08] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]"
                  : "border-white/10 bg-transparent text-white/55 hover:border-white/25 hover:text-white/90"
              }`}
            >
              <ToolIcon tool={id} />
            </button>
          );
        })}

        <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={disabled || !canUndo}
            aria-label="undo"
            title="undo"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/55 transition-colors duration-150 hover:border-white/25 hover:text-white/90 disabled:opacity-30"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={disabled || !canRedo}
            aria-label="redo"
            title="redo"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/55 transition-colors duration-150 hover:border-white/25 hover:text-white/90 disabled:opacity-30"
          >
            <RedoIcon />
          </button>
          <button
            type="button"
            onClick={clearDrawing}
            disabled={
              disabled || (strokes.length === 0 && livePoints.length === 0)
            }
            aria-label="clear"
            title="clear canvas"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/55 transition-colors duration-150 hover:border-rose-300/40 hover:text-rose-200/90 disabled:opacity-30"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Color row */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">
          color
        </span>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PRESETS.map((preset) => {
            const selected =
              preset.toLowerCase() === color.toLowerCase() && tool !== "eraser";
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setColor(preset)}
                disabled={disabled || tool === "eraser"}
                aria-label={`color ${preset}`}
                className="h-8 w-8 rounded-full border transition-transform duration-150 active:scale-95 disabled:opacity-40 sm:h-7 sm:w-7 sm:hover:scale-110"
                style={{
                  backgroundColor: preset,
                  borderColor: selected
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.15)",
                  boxShadow: selected
                    ? `0 0 0 2px rgba(255,255,255,0.15), 0 0 12px ${preset}66`
                    : undefined,
                }}
              />
            );
          })}
        </div>

        <label
          className={`relative ml-1 inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/15 sm:h-7 sm:w-7 ${
            disabled || tool === "eraser" ? "opacity-40" : "cursor-pointer"
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
            className="absolute inset-1 rounded-full bg-[#0c0816]"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={tryNormalizeHex(color)}
            onChange={(event) => setColor(event.target.value)}
            disabled={disabled || tool === "eraser"}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="custom color"
          />
        </label>
      </div>

      {/* Width + Opacity */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">
            size
          </span>
          <input
            type="range"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={1}
            value={brushWidth}
            onChange={(event) => setBrushWidth(Number(event.target.value))}
            disabled={disabled}
            className="flex-1 accent-white/80"
            aria-label="brush size"
          />
          <span className="flex h-7 w-12 items-center justify-center rounded-md border border-white/10 bg-black/20 text-[11px] tabular-nums text-white/60">
            {brushWidth}
          </span>
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center"
          >
            <span
              className="rounded-full"
              style={{
                width: Math.min(MAX_WIDTH, Math.max(2, brushWidth)),
                height: Math.min(MAX_WIDTH, Math.max(2, brushWidth)),
                backgroundColor: tool === "eraser" ? "#9ca3af" : color,
                opacity: tool === "marker" ? Math.min(opacity, 0.55) : opacity,
                boxShadow:
                  tool === "eraser"
                    ? "0 0 0 1px rgba(255,255,255,0.4) inset"
                    : `0 0 8px ${color}66`,
              }}
            />
          </span>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">
            opacity
          </span>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={Math.round(opacity * 100)}
            onChange={(event) =>
              setOpacity(Math.max(0.05, Number(event.target.value) / 100))
            }
            disabled={disabled || tool === "eraser"}
            className="flex-1 accent-white/80 disabled:opacity-40"
            aria-label="opacity"
          />
          <span className="flex h-7 w-12 items-center justify-center rounded-md border border-white/10 bg-black/20 text-[11px] tabular-nums text-white/60">
            {Math.round(opacity * 100)}
          </span>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-light text-white/40">
          {strokes.length === 0
            ? "blank canvas. start anywhere."
            : `${strokes.length} stroke${strokes.length === 1 ? "" : "s"}.`}
        </p>
        <p className="hidden text-[10px] font-light uppercase tracking-[0.2em] text-white/25 sm:block">
          {tool}
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={DRAWING_CANVAS_WIDTH}
        height={DRAWING_CANVAS_HEIGHT}
        onPointerDown={beginStroke}
        onPointerMove={continueStroke}
        onPointerUp={endStroke}
        onPointerLeave={(event) => {
          setCursor(null);
          endStroke(event);
        }}
        onPointerCancel={endStroke}
        onContextMenu={(event) => event.preventDefault()}
        className="w-full rounded-2xl border border-white/10 touch-none select-none overscroll-contain shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]"
        style={{
          aspectRatio: `${DRAWING_CANVAS_WIDTH} / ${DRAWING_CANVAS_HEIGHT}`,
          cursor: cursorStyle,
        }}
      />
    </div>
  );

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scaleX = DRAWING_CANVAS_WIDTH / bounds.width;
    const scaleY = DRAWING_CANVAS_HEIGHT / bounds.height;
    return {
      x: (event.clientX - bounds.left) * scaleX,
      y: (event.clientY - bounds.top) * scaleY,
    };
  }

  function scatterDots(center: DrawingPoint, size: number): DrawingPoint[] {
    const radius = size * SPRAY_RADIUS_MULT;
    const out: DrawingPoint[] = [];
    for (let i = 0; i < SPRAY_DOTS_PER_TICK; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * radius;
      out.push({
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance,
      });
    }
    return out;
  }
}

// ── Canvas painting ─────────────────────────────────────────────────────────

type PaintArgs = {
  strokes: DrawingStroke[];
  livePoints: DrawingPoint[];
  cursor: DrawingPoint | null;
  tool: DrawingTool;
  color: string;
  width: number;
  opacity: number;
  isDrawing: boolean;
};

function paintScene(context: CanvasRenderingContext2D, args: PaintArgs) {
  const { strokes, livePoints, cursor, tool, color, width, opacity, isDrawing } =
    args;

  // Backdrop with very subtle grid.
  context.clearRect(0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);
  context.fillStyle = "rgba(8, 6, 14, 0.92)";
  context.fillRect(0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);

  context.strokeStyle = "rgba(255, 255, 255, 0.04)";
  context.lineWidth = 1;
  for (let x = 40; x < DRAWING_CANVAS_WIDTH; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, DRAWING_CANVAS_HEIGHT);
    context.stroke();
  }
  for (let y = 40; y < DRAWING_CANVAS_HEIGHT; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(DRAWING_CANVAS_WIDTH, y);
    context.stroke();
  }

  // Committed strokes.
  for (const stroke of strokes) {
    paintStroke(context, stroke);
  }

  // Live preview.
  if (isDrawing && livePoints.length > 0) {
    if (tool === "spray") {
      paintStroke(context, {
        points: livePoints,
        color,
        width: Math.max(1, Math.round(width * 0.45)),
        opacity,
        tool: "spray",
      });
    } else if (tool === "line") {
      const start = livePoints[0];
      const end = livePoints[livePoints.length - 1];
      paintStroke(context, {
        points: [start, end],
        color,
        width,
        opacity,
      });
    } else if (tool === "rect") {
      const start = livePoints[0];
      const end = livePoints[livePoints.length - 1];
      paintStroke(context, {
        points: rectPolyline(start, end),
        color,
        width,
        opacity,
      });
    } else if (tool === "ellipse") {
      const start = livePoints[0];
      const end = livePoints[livePoints.length - 1];
      paintStroke(context, {
        points: ellipsePolyline(start, end, ELLIPSE_SEGMENTS),
        color,
        width,
        opacity,
      });
    } else if (tool === "eraser") {
      // Strokes were already mutated; nothing to preview here.
    } else if (tool === "marker") {
      paintStroke(context, {
        points: livePoints,
        color,
        width: Math.max(width * 1.6, 6),
        opacity: Math.min(opacity, 0.55),
      });
    } else {
      paintStroke(context, {
        points: livePoints,
        color,
        width,
        opacity,
      });
    }
  }

  // Tool cursor — a soft ring showing the brush size at the pointer.
  if (cursor && !isDrawing) {
    paintToolCursor(context, cursor, tool, width);
  } else if (cursor && tool === "eraser" && isDrawing) {
    paintToolCursor(context, cursor, tool, width);
  }
}

function paintStroke(context: CanvasRenderingContext2D, stroke: DrawingStroke) {
  const points = stroke.points;
  if (!points || points.length === 0) return;

  const color = stroke.color ?? "#f5f5f5";
  const width = stroke.width ?? 5;
  const alpha = stroke.opacity ?? 1;

  context.save();
  context.globalAlpha = alpha;

  if (stroke.tool === "spray") {
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 4;
    const radius = Math.max(0.6, width / 2);
    for (const p of points) {
      context.beginPath();
      context.arc(p.x, p.y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    return;
  }

  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = color;
  context.shadowBlur = alpha < 0.6 ? 0 : 4;

  if (points.length === 1) {
    const only = points[0];
    context.beginPath();
    context.arc(only.x, only.y, width / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    context.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }
  const last = points[points.length - 1];
  context.lineTo(last.x, last.y);
  context.stroke();
  context.restore();
}

function paintToolCursor(
  context: CanvasRenderingContext2D,
  cursor: DrawingPoint,
  tool: DrawingTool,
  width: number,
) {
  context.save();
  context.lineWidth = 1;
  if (tool === "eraser") {
    const radius = Math.max(4, (width * ERASER_SCALE) / 2);
    context.strokeStyle = "rgba(255,255,255,0.6)";
    context.setLineDash([3, 3]);
    context.beginPath();
    context.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
    context.stroke();
  } else if (tool === "spray") {
    const radius = Math.max(4, width * SPRAY_RADIUS_MULT);
    context.strokeStyle = "rgba(255,255,255,0.25)";
    context.setLineDash([2, 4]);
    context.beginPath();
    context.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
    context.stroke();
  } else if (tool !== "line" && tool !== "rect" && tool !== "ellipse") {
    const radius = Math.max(2, width / 2);
    context.strokeStyle = "rgba(255,255,255,0.25)";
    context.beginPath();
    context.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

// ── Geometry helpers ───────────────────────────────────────────────────────

function rectPolyline(a: DrawingPoint, b: DrawingPoint): DrawingPoint[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y },
    { x: a.x, y: a.y },
  ];
}

function ellipsePolyline(
  a: DrawingPoint,
  b: DrawingPoint,
  segments: number,
): DrawingPoint[] {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const out: DrawingPoint[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    out.push({
      x: cx + Math.cos(t) * rx,
      y: cy + Math.sin(t) * ry,
    });
  }
  return out;
}

function applyEraser(
  strokes: DrawingStroke[],
  eraserPath: DrawingPoint[],
  radius: number,
): DrawingStroke[] {
  if (eraserPath.length === 0) return strokes;
  const r2 = radius * radius;

  const result: DrawingStroke[] = [];
  for (const stroke of strokes) {
    if (stroke.tool === "spray") {
      const survivors = stroke.points.filter(
        (p) => !pointHitsEraser(p, eraserPath, r2),
      );
      if (survivors.length > 0) {
        result.push({ ...stroke, points: survivors });
      }
      continue;
    }

    let buffer: DrawingPoint[] = [];
    const flush = () => {
      if (buffer.length > 0) {
        result.push({ ...stroke, points: buffer });
        buffer = [];
      }
    };
    for (const p of stroke.points) {
      if (pointHitsEraser(p, eraserPath, r2)) {
        flush();
      } else {
        buffer.push(p);
      }
    }
    flush();
  }
  return result;
}

function pointHitsEraser(
  point: DrawingPoint,
  path: DrawingPoint[],
  r2: number,
) {
  for (let i = 0; i < path.length; i += 1) {
    const e = path[i];
    const dx = e.x - point.x;
    const dy = e.y - point.y;
    if (dx * dx + dy * dy <= r2) return true;
    if (i > 0) {
      const prev = path[i - 1];
      // Distance from point to segment prev → e.
      const ex = e.x - prev.x;
      const ey = e.y - prev.y;
      const px = point.x - prev.x;
      const py = point.y - prev.y;
      const len2 = ex * ex + ey * ey;
      if (len2 > 0) {
        const t = Math.max(0, Math.min(1, (px * ex + py * ey) / len2));
        const sx = prev.x + ex * t - point.x;
        const sy = prev.y + ey * t - point.y;
        if (sx * sx + sy * sy <= r2) return true;
      }
    }
  }
  return false;
}

function distance(first: DrawingPoint, second: DrawingPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function tryNormalizeHex(value: string): string {
  if (/^#([0-9a-f]{6})$/i.test(value)) return value;
  if (/^#([0-9a-f]{3})$/i.test(value)) {
    const m = value.slice(1);
    return `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`;
  }
  return "#ffffff";
}

// ── Tool icons ──────────────────────────────────────────────────────────────

function ToolIcon({ tool }: { tool: DrawingTool }) {
  switch (tool) {
    case "pen":
      return <PenIcon />;
    case "marker":
      return <MarkerIcon />;
    case "eraser":
      return <EraserIcon />;
    case "spray":
      return <SprayIcon />;
    case "line":
      return <LineIcon />;
    case "rect":
      return <RectIcon />;
    case "ellipse":
      return <EllipseIcon />;
  }
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PenIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" />
      <path d="M14 6l3 3" />
    </svg>
  );
}

function MarkerIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14 4l6 6-9 9-6 1 1-6 8-10z" />
      <path d="M11 7l6 6" />
      <path d="M5 20h14" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M16 4l4 4-9 9H6l-2-2 9-9z" />
      <path d="M9 13l4 4" />
      <path d="M5 21h14" />
    </svg>
  );
}

function SprayIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="9" y="9" width="8" height="11" rx="1.5" />
      <path d="M11 6h4v3h-4z" />
      <path d="M7 4h1M5 6h1M7 8h1" />
      <circle cx="20" cy="5" r="0.6" fill="currentColor" />
      <circle cx="22" cy="8" r="0.6" fill="currentColor" />
      <circle cx="20" cy="11" r="0.6" fill="currentColor" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg {...ICON_PROPS}>
      <line x1="4" y1="20" x2="20" y2="4" />
    </svg>
  );
}

function RectIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="4" y="6" width="16" height="12" rx="1.5" />
    </svg>
  );
}

function EllipseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <ellipse cx="12" cy="12" rx="8" ry="6" />
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
