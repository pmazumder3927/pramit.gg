"use client";

import { useEffect, useRef, useState } from "react";

import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
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

type BrushSize = {
  id: "fine" | "medium" | "thick";
  label: string;
  width: number;
};

const BRUSH_PALETTE: string[] = [
  "#f5f5f5",
  "#f8a4c8",
  "#ffd36d",
  "#b7ffca",
  "#b9ddff",
  "#d0c0ff",
  "#9df4f2",
  "#ff8f6b",
];

const BRUSH_SIZES: BrushSize[] = [
  { id: "fine", label: "fine", width: 3 },
  { id: "medium", label: "medium", width: 5 },
  { id: "thick", label: "thick", width: 8 },
];

const DEFAULT_COLOR = BRUSH_PALETTE[0];
const DEFAULT_BRUSH = BRUSH_SIZES[1];

export default function DrawingCaptcha({
  disabled = false,
  refreshKey = 0,
  onChange,
}: DrawingCaptchaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<DrawingPoint[]>([]);
  const [challengeResponse, setChallengeResponse] =
    useState<CaptchaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_COLOR);
  const [activeBrush, setActiveBrush] = useState<BrushSize>(DEFAULT_BRUSH);

  const challenge = challengeResponse?.challenge ?? null;
  const token = challengeResponse?.token ?? "";
  const drawingEvaluation = evaluateDrawing(strokes);
  const ready = Boolean(challenge && drawingEvaluation.ok);

  useEffect(() => {
    let ignore = false;

    async function loadChallenge() {
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
        if (ignore) {
          return;
        }

        setChallengeResponse(data);
        setStrokes([]);
        currentStrokeRef.current = [];
        setCurrentStroke([]);
        setIsDrawing(false);
        setActivePointerId(null);
      } catch (error) {
        if (ignore) {
          return;
        }

        console.error("Captcha load error:", error);
        setLoadError("Could not summon the council. Try again.");
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadChallenge();

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    // Render at devicePixelRatio for crisp lines on retina + mobile.
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const targetWidth = Math.round(DRAWING_CANVAS_WIDTH * dpr);
    const targetHeight = Math.round(DRAWING_CANVAS_HEIGHT * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawCanvas(context, strokes, currentStroke, activeColor, activeBrush.width);
  }, [strokes, currentStroke, activeColor, activeBrush.width]);

  useEffect(() => {
    if (!ready || !challenge) {
      onChange(null, false);
      return;
    }

    onChange({ token, strokes }, true);
  }, [challenge, onChange, ready, strokes, token]);

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) {
      return;
    }

    const point = getCanvasPoint(event);
    setIsDrawing(true);
    setActivePointerId(event.pointerId);
    currentStrokeRef.current = [point];
    setCurrentStroke([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drawStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activePointerId !== event.pointerId) {
      return;
    }

    const point = getCanvasPoint(event);

    setCurrentStroke((previous) => {
      const lastPoint = previous[previous.length - 1];
      if (lastPoint && distance(lastPoint, point) < 0.75) {
        return previous;
      }

      const nextStroke = [...previous, point];
      currentStrokeRef.current = nextStroke;
      return nextStroke;
    });
  };

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activePointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDrawing(false);
    setActivePointerId(null);

    const finalizedStroke = currentStrokeRef.current;

    setStrokes((previous) => {
      if (!finalizedStroke.length) {
        return previous;
      }

      return [
        ...previous,
        {
          points: finalizedStroke,
          color: activeColor,
          width: activeBrush.width,
        },
      ];
    });

    currentStrokeRef.current = [];
    setCurrentStroke([]);
  };

  const clearDrawing = () => {
    setStrokes([]);
    currentStrokeRef.current = [];
    setCurrentStroke([]);
    setIsDrawing(false);
    setActivePointerId(null);
  };

  const undoStroke = () => {
    setStrokes((previous) => previous.slice(0, -1));
  };

  const reload = () => {
    setChallengeResponse(null);
    setStrokes([]);
    currentStrokeRef.current = [];
    setCurrentStroke([]);
    setIsDrawing(false);
    setActivePointerId(null);
    setLoadError(null);
    setIsLoading(true);

    void (async () => {
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
        console.error("Captcha reload error:", error);
        setLoadError("Could not summon the council. Try again.");
      } finally {
        setIsLoading(false);
      }
    })();
  };

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
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/30">
            the council asks
          </p>
          <h3 className="mt-1 text-xl md:text-2xl font-extralight text-white/90">
            draw{" "}
            <span className="text-white">
              {challenge.drawingPrompt}
            </span>
          </h3>
          <p className="mt-1 text-xs font-light text-white/40">
            the council will judge whether your drawing is good enough.
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

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-light text-white/40">
          {strokes.length === 0
            ? "any sincere attempt is fine."
            : `${strokes.length} stroke${strokes.length === 1 ? "" : "s"}.`}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={undoStroke}
            disabled={disabled || strokes.length === 0}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-light text-white/50 transition-colors duration-300 hover:text-white/80 disabled:opacity-30"
          >
            undo
          </button>
          <button
            type="button"
            onClick={clearDrawing}
            disabled={
              disabled || (strokes.length === 0 && currentStroke.length === 0)
            }
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-light text-white/50 transition-colors duration-300 hover:text-white/80 disabled:opacity-30"
          >
            clear
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5">
        <div className="flex flex-wrap gap-2">
          {BRUSH_PALETTE.map((color) => {
            const selected = color === activeColor;
            return (
              <button
                key={color}
                type="button"
                onClick={() => setActiveColor(color)}
                disabled={disabled}
                aria-label={`color ${color}`}
                className="h-9 w-9 rounded-full border transition-transform duration-200 active:scale-95 disabled:opacity-40 sm:h-8 sm:w-8 sm:hover:scale-110"
                style={{
                  backgroundColor: color,
                  borderColor: selected
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.15)",
                  boxShadow: selected
                    ? `0 0 0 2px rgba(255,255,255,0.18), 0 0 12px ${color}66`
                    : undefined,
                }}
              />
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {BRUSH_SIZES.map((size) => {
            const selected = size.id === activeBrush.id;
            return (
              <button
                key={size.id}
                type="button"
                onClick={() => setActiveBrush(size)}
                disabled={disabled}
                aria-label={`brush ${size.label}`}
                className="flex h-10 w-10 items-center justify-center rounded-xl border transition-colors duration-200 active:scale-95 disabled:opacity-40 sm:h-9 sm:w-9 sm:hover:border-white/30"
                style={{
                  borderColor: selected
                    ? "rgba(255,255,255,0.6)"
                    : "rgba(255,255,255,0.1)",
                  backgroundColor: selected
                    ? "rgba(255,255,255,0.04)"
                    : "transparent",
                }}
              >
                <span
                  className="rounded-full transition-all"
                  style={{
                    width: size.width + 4,
                    height: size.width + 4,
                    backgroundColor: activeColor,
                    boxShadow: selected ? `0 0 8px ${activeColor}80` : undefined,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={DRAWING_CANVAS_WIDTH}
        height={DRAWING_CANVAS_HEIGHT}
        onPointerDown={beginStroke}
        onPointerMove={drawStroke}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
        className="w-full rounded-2xl border border-white/10 touch-none select-none overscroll-contain shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]"
        style={{
          aspectRatio: `${DRAWING_CANVAS_WIDTH} / ${DRAWING_CANVAS_HEIGHT}`,
          cursor: disabled ? "not-allowed" : "crosshair",
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
}

function drawCanvas(
  context: CanvasRenderingContext2D,
  strokes: DrawingStroke[],
  currentStroke: DrawingPoint[],
  currentColor: string,
  currentWidth: number,
) {
  context.clearRect(0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);
  context.fillStyle = "rgba(8, 6, 14, 0.85)";
  context.fillRect(0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);

  context.strokeStyle = "rgba(255, 255, 255, 0.05)";
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

  strokes.forEach((stroke) => paintStroke(context, stroke));

  if (currentStroke.length > 0) {
    paintStroke(context, {
      points: currentStroke,
      color: currentColor,
      width: currentWidth,
    });
  }
}

function paintStroke(
  context: CanvasRenderingContext2D,
  stroke: DrawingStroke,
) {
  const points = stroke.points;
  if (points.length === 0) {
    return;
  }

  const color = stroke.color ?? "#f5f5f5";
  const width = stroke.width ?? 5;

  if (points.length === 1) {
    const only = points[0];
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 6;
    context.beginPath();
    context.arc(only.x, only.y, width / 2, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    return;
  }

  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = color;
  context.shadowBlur = 6;

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    context.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  const last = points[points.length - 1];
  context.lineTo(last.x, last.y);
  context.stroke();
  context.shadowBlur = 0;
}

function distance(first: DrawingPoint, second: DrawingPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
