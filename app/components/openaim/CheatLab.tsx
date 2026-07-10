"use client";

// The exploit audit, playable. Four synthetic players — one honest, three
// dishonest — run the same drills under two graders: a naive score
// (accuracy × kills) and openaim's anti-exploit grade (pace budget + quality).
// Numbers are illustrative but story-true to the real audit (the rhythm-reading
// bot out-scored the honest player 4.7× on multi-taps before the fix).

import { useState } from "react";
import { C, Toggle, VizCard } from "./kit";

type Bot = {
  key: string;
  name: string;
  scheme: string;
  naive: number;
  guarded: number;
  counter: string;
  color: string;
};

const BOTS: Bot[] = [
  {
    key: "honest",
    name: "honest",
    scheme:
      "reacts, plans a ballistic primary, corrects, tracks before clicking — the model's idea of a human.",
    naive: 58,
    guarded: 66,
    counter: "under the real grader it wins every drill family. as it should.",
    color: C.hit,
  },
  {
    key: "sprayer",
    name: "sprayer",
    scheme: "clicks at the weapon's max cadence and lets volume do the aiming.",
    naive: 79,
    guarded: 28,
    counter:
      "every shot past hits-to-kill is charged against the pace budget, and quality requires a clean kill — spam now costs exactly what it earns.",
    color: C.acc,
  },
  {
    key: "camper",
    name: "camper",
    scheme: "parks on the highest-traffic spot and refuses to chase.",
    naive: 66,
    guarded: 24,
    counter:
      "idle time is charged against the full window, timeouts are real zeros, and no mechanic sits dormant at spawn to be farmed.",
    color: C.pur,
  },
  {
    key: "reader",
    name: "2-tap reader",
    scheme:
      "ignores aim entirely and memorizes the rhythm — pre-fix, it out-scored the honest bot 4.7× on multi-taps.",
    naive: 88,
    guarded: 31,
    counter:
      "cadence is decoupled from aim: consecutive kills demand real crosshair travel, and multi-taps are graded on cleanliness against hits-to-kill.",
    color: C.rust,
  },
];

export default function CheatLab() {
  const [guarded, setGuarded] = useState(false);
  const [picked, setPicked] = useState<string>("reader");
  const bot = BOTS.find((b) => b.key === picked)!;
  const honest = BOTS[0];
  const scoreOf = (b: Bot) => (guarded ? b.guarded : b.naive);
  const beaters = BOTS.filter((b) => b.key !== "honest" && scoreOf(b) > scoreOf(honest)).length;

  return (
    <VizCard
      title="try to rob the grader"
      hint="four bots walk into a drill…"
      caption={
        <>
          fig — the standing exploit audit, playable. adversarial synthetic
          players attack every drill family through the real engine; a dishonest
          strategy out-scoring the honest one fails CI. flip the grader and watch
          who profits.
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Toggle on={!guarded} onClick={() => setGuarded(false)}>
            naive score — accuracy × kills
          </Toggle>
          <Toggle on={guarded} onClick={() => setGuarded(true)} accent={C.hit}>
            openaim grade — pace + quality
          </Toggle>
        </div>

        <div className="flex flex-col gap-2">
          {BOTS.map((b) => {
            const v = scoreOf(b);
            const isPicked = b.key === picked;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setPicked(b.key)}
                aria-pressed={isPicked}
                className="group grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 rounded-lg px-1 py-0.5 text-left sm:grid-cols-[8.5rem_1fr_3rem]"
              >
                <span
                  className="truncate font-mono text-sm"
                  style={{ color: isPicked ? b.color : C.soft }}
                >
                  {b.name}
                </span>
                <span className="block h-4 w-full overflow-hidden rounded-full border border-line/60 bg-paper-2/40">
                  <span
                    className="block h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${v}%`,
                      background: b.color,
                      opacity: isPicked ? 0.95 : 0.55,
                    }}
                  />
                </span>
                <span className="text-right font-mono text-sm tabular-nums" style={{ color: C.faint }}>
                  {v}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-line bg-paper-2/40 px-4 py-3">
          <div className="font-hand text-lg leading-snug text-ink-soft">
            <span className="font-mono text-sm" style={{ color: bot.color }}>
              {bot.name}
            </span>{" "}
            — {bot.scheme}
          </div>
          {guarded ? (
            <div className="mt-1.5 font-hand text-lg leading-snug" style={{ color: C.hit }}>
              {bot.counter}
            </div>
          ) : null}
        </div>

        <p className="text-center font-hand text-lg leading-snug" style={{ color: beaters > 0 ? C.rust : C.hit }}>
          {beaters > 0
            ? `${beaters} of 3 dishonest bots beat the honest player — this scoreboard trains cheesing, not aim.`
            : "0 exploitable — the honest player wins everywhere, so the score finally measures aim."}
        </p>
      </div>
    </VizCard>
  );
}
