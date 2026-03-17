"use client";

import { useEffect, useRef, useState } from "react";

import {
  TURTLE_CANVAS_HEIGHT,
  TURTLE_CANVAS_WIDTH,
  type CaptchaGlyph,
  type ConfessionalCaptchaChallenge,
  type ConfessionalCaptchaSubmission,
  type TurtlePoint,
  type TurtleStroke,
  evaluateTurtleDrawing,
  normalizeCaptchaPhrase,
} from "@/app/lib/confessional-captcha";

type TurtleCaptchaProps = {
  disabled?: boolean;
  refreshKey?: number;
  onChange: (
    payload: ConfessionalCaptchaSubmission | null,
    solved: boolean,
  ) => void;
};

type CaptchaResponse = {
  token: string;
  challenge: ConfessionalCaptchaChallenge;
};

const STROKE_COLORS = [
  "#f2d1b0",
  "#b9ddff",
  "#b7ffca",
  "#f8a4c8",
  "#ffe28a",
  "#d0c0ff",
  "#9df4f2",
];

export default function TurtleCaptcha({
  disabled = false,
  refreshKey = 0,
  onChange,
}: TurtleCaptchaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<TurtlePoint[]>([]);
  const [challengeResponse, setChallengeResponse] =
    useState<CaptchaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [selectedGlyphs, setSelectedGlyphs] = useState<string[]>([]);
  const [glyphFeedback, setGlyphFeedback] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<TurtleStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<TurtlePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);

  const challenge = challengeResponse?.challenge ?? null;
  const token = challengeResponse?.token ?? "";
  const drawingEvaluation = evaluateTurtleDrawing(strokes);
  const glyphPrompt = challenge
    ? challenge.glyphOrder
        .map(
          (glyphId) =>
            challenge.glyphs.find((glyph) => glyph.id === glyphId)?.label ??
            glyphId,
        )
        .join(" -> ")
    : "";
  const phraseSolved = challenge
    ? normalizeCaptchaPhrase(phrase) === challenge.phrase
    : false;
  const glyphSolved =
    challenge &&
    selectedGlyphs.length === challenge.glyphOrder.length &&
    selectedGlyphs.every(
      (glyphId, index) => glyphId === challenge.glyphOrder[index],
    );
  const solved = Boolean(
    challenge && phraseSolved && glyphSolved && drawingEvaluation.ok,
  );
  const currentStep = Math.min(strokes.length + 1, 7);
  const showDrawingError =
    strokes.length > 0 &&
    !drawingEvaluation.ok &&
    drawingEvaluation.errors.length > 0;

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
          throw new Error("Could not load the captcha ritual.");
        }

        const data = (await response.json()) as CaptchaResponse;
        if (ignore) {
          return;
        }

        setChallengeResponse(data);
        setPhrase("");
        setSelectedGlyphs([]);
        setGlyphFeedback(null);
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
        setLoadError("Could not load the captcha ritual. Try again.");
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
    if (!canvasRef.current) {
      return;
    }

    const context = canvasRef.current.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, TURTLE_CANVAS_WIDTH, TURTLE_CANVAS_HEIGHT);
    context.fillStyle = "rgba(255, 255, 255, 0.02)";
    context.fillRect(0, 0, TURTLE_CANVAS_WIDTH, TURTLE_CANVAS_HEIGHT);

    context.strokeStyle = "rgba(255, 255, 255, 0.08)";
    context.lineWidth = 1;
    for (let x = 40; x < TURTLE_CANVAS_WIDTH; x += 40) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, TURTLE_CANVAS_HEIGHT);
      context.stroke();
    }

    for (let y = 40; y < TURTLE_CANVAS_HEIGHT; y += 40) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(TURTLE_CANVAS_WIDTH, y);
      context.stroke();
    }

    [...strokes, { points: currentStroke }]
      .filter((stroke) => stroke.points.length > 0)
      .forEach((stroke, index) => {
        const color = STROKE_COLORS[index] ?? "#ffffff";
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = 4;
        context.beginPath();

        stroke.points.forEach((point, pointIndex) => {
          if (pointIndex === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        });

        context.stroke();

        const anchor = stroke.points[0];
        context.font = "12px monospace";
        context.fillText(String(index + 1), anchor.x + 6, anchor.y - 6);
      });
  }, [strokes, currentStroke]);

  useEffect(() => {
    if (!solved || !challenge) {
      onChange(null, false);
      return;
    }

    onChange(
      {
        token,
        phrase,
        glyphOrder: selectedGlyphs,
        strokes,
      },
      true,
    );
  }, [challenge, onChange, phrase, selectedGlyphs, solved, strokes, token]);

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || strokes.length >= 7) {
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
      if (lastPoint && distance(lastPoint, point) < 2) {
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
      if (!finalizedStroke.length || previous.length >= 7) {
        return previous;
      }

      return [...previous, { points: finalizedStroke }];
    });

    currentStrokeRef.current = [];
    setCurrentStroke([]);
  };

  const resetGlyphSequence = () => {
    setSelectedGlyphs([]);
    setGlyphFeedback("Glyph order reset.");
  };

  const handleGlyphClick = (glyph: CaptchaGlyph) => {
    if (!challenge || disabled || glyphSolved) {
      return;
    }

    const expectedGlyphId = challenge.glyphOrder[selectedGlyphs.length];

    if (glyph.id !== expectedGlyphId) {
      setSelectedGlyphs([]);
      setGlyphFeedback("Wrong glyph. Sequence reset.");
      return;
    }

    const nextSelection = [...selectedGlyphs, glyph.id];
    setSelectedGlyphs(nextSelection);
    setGlyphFeedback(
      nextSelection.length === challenge.glyphOrder.length
        ? "Glyph sequence accepted."
        : `Accepted ${nextSelection.length}/${challenge.glyphOrder.length}.`,
    );
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
    setPhrase("");
    setSelectedGlyphs([]);
    setGlyphFeedback(null);
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
          throw new Error("Could not load the captcha ritual.");
        }

        const data = (await response.json()) as CaptchaResponse;
        setChallengeResponse(data);
      } catch (error) {
        console.error("Captcha reload error:", error);
        setLoadError("Could not reload the captcha ritual. Try again.");
      } finally {
        setIsLoading(false);
      }
    })();
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="text-sm font-light text-white/40">
          loading the anti-bot ritual...
        </p>
      </div>
    );
  }

  if (loadError || !challenge) {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-5">
        <p className="mb-3 text-sm font-light text-rose-100/80">
          {loadError ?? "The captcha ritual is unavailable."}
        </p>
        <button
          type="button"
          onClick={reload}
          className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-light text-white/70 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white/90"
        >
          reload ritual
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/30">
            captcha ritual
          </p>
          <h3 className="mt-1 text-lg font-light text-white/85">
            complete every step to whisper
          </h3>
        </div>

        <button
          type="button"
          onClick={reload}
          disabled={disabled}
          className="self-start rounded-xl border border-white/10 px-3 py-2 text-xs font-light text-white/50 transition-colors duration-300 hover:border-white/20 hover:text-white/80 disabled:opacity-40"
        >
          new ritual
        </button>
      </div>

      <div className="mb-5 grid gap-2 md:grid-cols-3">
        <StatusPill label="phrase" complete={phraseSolved} />
        <StatusPill label="glyphs" complete={Boolean(glyphSolved)} />
        <StatusPill label="turtle" complete={drawingEvaluation.ok} />
      </div>

      <div className="space-y-5">
        <section className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.24em] text-white/30">
            1. recite the passphrase
          </p>
          <p className="mb-3 text-sm font-light text-white/60">
            Type this exactly:{" "}
            <span className="text-white/85">{challenge.phrase}</span>
          </p>
          <input
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            disabled={disabled}
            className="w-full rounded-xl border border-white/[0.08] bg-transparent px-4 py-3 text-sm font-light text-white/80 outline-none transition-colors duration-300 placeholder:text-white/20 focus:border-white/20 disabled:opacity-50"
            placeholder="repeat the phrase exactly"
          />
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
          <div className="mb-3">
            <p className="mb-2 text-xs uppercase tracking-[0.24em] text-white/30">
              2. tap the glyphs in order
            </p>
            <p className="text-sm font-light text-white/60">{glyphPrompt}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {challenge.glyphs.map((glyph) => {
              const position = selectedGlyphs.indexOf(glyph.id);
              const isSelected = position >= 0;

              return (
                <button
                  key={glyph.id}
                  type="button"
                  onClick={() => handleGlyphClick(glyph)}
                  disabled={disabled || isSelected || Boolean(glyphSolved)}
                  className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04] disabled:opacity-50"
                  style={{
                    boxShadow: isSelected
                      ? `inset 0 0 0 1px ${glyph.accent}`
                      : undefined,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl" style={{ color: glyph.accent }}>
                      {glyph.symbol}
                    </span>
                    <span className="text-xs text-white/25">
                      {isSelected ? position + 1 : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-light text-white/75">
                    {glyph.label}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs font-light text-white/35">
              {glyphFeedback ?? "A wrong tap resets the sequence."}
            </p>
            <button
              type="button"
              onClick={resetGlyphSequence}
              disabled={disabled || selectedGlyphs.length === 0}
              className="text-xs font-light text-white/45 transition-colors duration-300 hover:text-white/75 disabled:opacity-30"
            >
              reset glyphs
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.24em] text-white/30">
                3. draw the turtle blueprint
              </p>
              <p className="text-sm font-light text-white/60">
                Current stroke: {currentStep}/7. The first stroke must be the
                shell.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={undoStroke}
                disabled={disabled || strokes.length === 0}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-light text-white/50 transition-colors duration-300 hover:text-white/80 disabled:opacity-30"
              >
                undo stroke
              </button>
              <button
                type="button"
                onClick={clearDrawing}
                disabled={
                  disabled ||
                  (strokes.length === 0 && currentStroke.length === 0)
                }
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-light text-white/50 transition-colors duration-300 hover:text-white/80 disabled:opacity-30"
              >
                clear turtle
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-2">
            {challenge.turtleSteps.map((step) => (
              <p key={step} className="text-sm font-light text-white/58">
                {step}
              </p>
            ))}
          </div>

          <canvas
            ref={canvasRef}
            width={TURTLE_CANVAS_WIDTH}
            height={TURTLE_CANVAS_HEIGHT}
            onPointerDown={beginStroke}
            onPointerMove={drawStroke}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
            className="mb-4 w-full rounded-2xl border border-dashed border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_60%)] touch-none"
          />

          <div className="grid gap-2">
            {drawingEvaluation.checklist.map((item) => (
              <div
                key={item.key}
                className={`rounded-xl border px-3 py-2 text-sm font-light ${
                  item.passed
                    ? "border-emerald-400/20 bg-emerald-500/5 text-emerald-100/80"
                    : "border-white/[0.06] bg-white/[0.02] text-white/45"
                }`}
              >
                {item.label}
              </div>
            ))}
          </div>

          {showDrawingError ? (
            <p className="mt-3 text-xs font-light text-amber-100/70">
              {drawingEvaluation.errors[0]}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scaleX = TURTLE_CANVAS_WIDTH / bounds.width;
    const scaleY = TURTLE_CANVAS_HEIGHT / bounds.height;

    return {
      x: (event.clientX - bounds.left) * scaleX,
      y: (event.clientY - bounds.top) * scaleY,
    };
  }
}

function StatusPill({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-sm font-light ${
        complete
          ? "border-emerald-400/20 bg-emerald-500/5 text-emerald-100/80"
          : "border-white/[0.06] bg-white/[0.02] text-white/45"
      }`}
    >
      {complete ? "complete" : "pending"} / {label}
    </div>
  );
}

function distance(first: TurtlePoint, second: TurtlePoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
