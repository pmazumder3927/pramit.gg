"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, C, VizCard, sigmoid } from "./kit";

const SKILL = 3.2;
const TARGET_SUCCESS = 0.7;
const CHALLENGE_TAU = 0.9;
const MIN_DEMAND = 0;
const MAX_DEMAND = 6;

function logit(p: number) {
  return Math.log(p / (1 - p));
}

function demandForSuccess(p: number) {
  return SKILL - logit(p);
}

function demandPercent(demand: number) {
  return ((demand - MIN_DEMAND) / (MAX_DEMAND - MIN_DEMAND)) * 100;
}

function readout(success: number) {
  if (success > 0.84) {
    return {
      title: "comfortable, but not very revealing",
      body: "You get lots of clean repetitions, but the drill exposes little about where control breaks.",
      color: C.pur,
    };
  }
  if (success < 0.54) {
    return {
      title: "more struggle than useful practice",
      body: "Failures dominate. The coach would ease the geometry until clean attempts become repeatable again.",
      color: C.rust,
    };
  }
  return {
    title: "useful struggle",
    body: "Enough successes to reinforce the movement, enough failures to reveal what the next drill should train.",
    color: C.hit,
  };
}

export default function ChallengePoint() {
  const [demand, setDemand] = useState(1.4);
  const raf = useRef<number | null>(null);

  const success = sigmoid(SKILL - demand);
  const successPct = Math.round(success * 100);
  const targetDemand = demandForSuccess(TARGET_SUCCESS);
  const challengeDistance = logit(success) - logit(TARGET_SUCCESS);
  const challengeFit = Math.exp(
    -(challengeDistance * challengeDistance) / (2 * CHALLENGE_TAU * CHALLENGE_TAU),
  );
  const outcome = readout(success);
  const clears = Math.round(success * 10);
  const usefulLo = demandPercent(demandForSuccess(0.8));
  const usefulHi = demandPercent(demandForSuccess(0.6));
  const currentDifficulty = demandPercent(demand);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const tune = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const from = demand;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDemand(targetDemand);
      return;
    }
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 520);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDemand(from + (targetDemand - from) * eased);
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  return (
    <VizCard
      title="how hard should the next drill be?"
      hint="drag from comfortable to brutal"
      caption={
        <>
          fig — this isolates the challenge-fit part of the coach. 70% is the
          cold-start example; the real target becomes a player-specific
          posterior, while teaching value, information, and variety still
          decide which drill earns the slot.
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-5 rounded-lg border border-line/80 bg-paper-2/40 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-5">
          <div className="min-w-[8rem]">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              predicted clear rate
            </div>
            <div className="mt-1 font-mono text-5xl font-medium tabular-nums" style={{ color: outcome.color }}>
              {successPct}%
            </div>
          </div>

          <div>
            <div className="flex gap-1.5" aria-label={`About ${clears} clears in ten attempts`}>
              {Array.from({ length: 10 }, (_, index) => {
                const clear = index < clears;
                return (
                  <span
                    key={index}
                    className="h-4 flex-1 rounded-sm border transition-colors duration-200 motion-reduce:transition-none"
                    style={{
                      borderColor: clear ? C.hitA(0.8) : C.rustA(0.55),
                      background: clear ? C.hitA(0.72) : C.rustA(0.08),
                    }}
                    aria-hidden="true"
                  />
                );
              })}
            </div>
            <div className="mt-3 font-serif text-lg text-ink">{outcome.title}</div>
            <p className="mt-1 font-sans text-sm leading-relaxed text-ink-soft">{outcome.body}</p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <label htmlFor="challenge-difficulty" className="font-sans text-sm font-semibold text-ink">
              Drill difficulty
            </label>
            <output htmlFor="challenge-difficulty" className="font-mono text-sm text-ink-faint">
              {currentDifficulty < 32 ? "comfortable" : currentDifficulty > 50 ? "brutal" : "challenging"}
            </output>
          </div>
          <input
            id="challenge-difficulty"
            type="range"
            min={MIN_DEMAND}
            max={MAX_DEMAND}
            step={0.02}
            value={demand}
            onChange={(event) => setDemand(Number(event.target.value))}
            className="h-3 w-full cursor-pointer appearance-none rounded-full"
            style={{
              accentColor: C.acc,
              background: `linear-gradient(90deg, ${C.line} 0%, ${C.line} ${usefulLo}%, ${C.hitA(0.38)} ${usefulLo}%, ${C.hitA(0.38)} ${usefulHi}%, ${C.line} ${usefulHi}%, ${C.line} 100%)`,
            }}
            aria-describedby="challenge-scale-note"
          />
          <div id="challenge-scale-note" className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-faint">
            <span>easier · more clears</span>
            <span>harder · more failures</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-sans text-sm font-semibold text-ink">Challenge fit</span>
              <span className="font-mono text-sm tabular-nums" style={{ color: challengeFit > 0.9 ? C.hit : C.acc }}>
                {Math.round(challengeFit * 100)}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/70">
              <div
                className="h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: `${challengeFit * 100}%`, background: challengeFit > 0.9 ? C.hit : C.acc }}
              />
            </div>
            <p className="mt-2 font-sans text-xs leading-relaxed text-ink-faint">
              How closely this difficulty matches the example learning target—not a score for the whole candidate.
            </p>
          </div>
          <Btn onClick={tune}>tune near 70% →</Btn>
        </div>
      </div>
    </VizCard>
  );
}
