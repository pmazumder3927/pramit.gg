"use client";

import { useState } from "react";
import { C, VizCard, sigmoid } from "./kit";

const SUPPORT_LO = 0.55;
const SUPPORT_HI = 0.85;
const COLD_START_MEDIAN = 0.7016;
const KNOB_HALF_LOGIT = 0.08;
const JITTER_SD_LOGIT = 0.06;

function logit(p: number) {
  return Math.log(p / (1 - p));
}

function stripPosition(p: number) {
  return ((p - SUPPORT_LO) / (SUPPORT_HI - SUPPORT_LO)) * 100;
}

export default function ChallengePoint() {
  const [nudge, setNudge] = useState(0);
  const medianLogit = logit(COLD_START_MEDIAN);
  const target = sigmoid(medianLogit + nudge * KNOB_HALF_LOGIT);
  const targetPct = target * 100;
  const honestLo = sigmoid(medianLogit - KNOB_HALF_LOGIT);
  const honestHi = sigmoid(medianLogit + KNOB_HALF_LOGIT);
  const jitterLo = sigmoid(logit(target) - JITTER_SD_LOGIT);
  const jitterHi = sigmoid(logit(target) + JITTER_SD_LOGIT);
  const direction = nudge < -0.2 ? "harder" : nudge > 0.2 ? "easier" : "coach's pick";

  const sentence =
    nudge < -0.2
      ? `The coach searches for useful geometry it expects you to clear about ${targetPct.toFixed(1)}% of the time.`
      : nudge > 0.2
        ? `The coach searches for useful geometry it expects you to clear about ${targetPct.toFixed(1)}% of the time.`
        : `The coach searches near the currently learned sweet spot: about ${targetPct.toFixed(1)}% predicted success.`;

  return (
    <VizCard
      title="how hard should the next drill be?"
      hint="cold-start example · the peak is learned"
      caption={
        <>
          fig — this control nudges a quantile of the learned challenge-point
          posterior; it does not directly set target size or speed. the sampler
          reshapes a useful drill until its risk-adjusted prediction reaches
          that target.
        </>
      }
    >
      <div className="space-y-6">
        <div className="rounded-lg border border-line/80 bg-paper-2/40 px-4 py-5 text-center sm:px-6 sm:py-6">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            predicted success target
          </div>
          <div className="mt-1 font-mono text-5xl font-medium tabular-nums text-accent-orange sm:text-6xl">
            {targetPct.toFixed(1)}%
          </div>
          <p className="mx-auto mt-3 max-w-md font-sans text-sm leading-relaxed text-ink-soft" aria-live="polite">
            {sentence}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <label htmlFor="challenge-nudge" className="font-sans text-sm font-semibold text-ink">
              Difficulty nudge
            </label>
            <output htmlFor="challenge-nudge" className="font-mono text-sm text-accent-purple">
              {direction}
            </output>
          </div>
          <input
            id="challenge-nudge"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={nudge}
            onChange={(event) => setNudge(Number(event.target.value))}
            className="h-3 w-full cursor-pointer appearance-none rounded-full"
            style={{
              accentColor: C.pur,
              background: `linear-gradient(90deg, ${C.rustA(0.22)} 0%, ${C.line} 42%, ${C.hitA(0.34)} 50%, ${C.line} 58%, ${C.purA(0.22)} 100%)`,
            }}
            aria-describedby="challenge-nudge-scale"
          />
          <div id="challenge-nudge-scale" className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-faint">
            <span>harder</span>
            <span>stay near the learned zone</span>
            <span>easier</span>
          </div>
        </div>

        <section aria-labelledby="challenge-support-heading">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h5 id="challenge-support-heading" className="font-sans text-sm font-semibold text-ink">
              What the model currently supports
            </h5>
            <span className="font-mono text-[10px] text-ink-faint">cold-start example</span>
          </div>

          <div className="relative h-16" role="img" aria-label={`The example posterior spans 55 to 85 percent, with a narrow difficulty window from ${(honestLo * 100).toFixed(1)} to ${(honestHi * 100).toFixed(1)} percent and a current target of ${targetPct.toFixed(1)} percent`}>
            <div
              className="absolute inset-x-0 top-3 h-5 rounded-full border border-line/70"
              style={{
                background: `linear-gradient(90deg, ${C.purA(0.03)}, ${C.purA(0.16)} 28%, ${C.purA(0.36)} 50%, ${C.purA(0.16)} 72%, ${C.purA(0.03)})`,
              }}
            >
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: `${stripPosition(honestLo)}%`,
                  width: `${stripPosition(honestHi) - stripPosition(honestLo)}%`,
                  background: C.hitA(0.38),
                }}
              />
              <div
                className="absolute -top-1 h-7 w-px bg-accent-purple/70"
                style={{ left: `${stripPosition(COLD_START_MEDIAN)}%` }}
                aria-hidden="true"
              />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-accent-orange transition-[left] duration-200 motion-reduce:transition-none"
                style={{ left: `${stripPosition(target)}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="absolute inset-x-0 top-10 flex justify-between font-mono text-[10px] text-ink-faint">
              <span>55%</span>
              <span>learned zone</span>
              <span>85%</span>
            </div>
          </div>

          <p className="font-sans text-xs leading-relaxed text-ink-faint">
            Each decision also gets a tiny logged jitter—about {(jitterLo * 100).toFixed(1)}–{(jitterHi * 100).toFixed(1)}% here—so OpenAim can test whether this really is your best learning zone instead of merely assuming it.
          </p>
        </section>
      </div>
    </VizCard>
  );
}
