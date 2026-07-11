"use client";

// Interactive demo of the whole thesis: signal-dependent noise. Crank the flick
// speed and watch endpoint spread grow linearly — then toggle corrections and
// watch the corrective submovements drag the near-misses back in (and time out
// the far ones). 16 deterministic shots so SSR and client agree.

import { useMemo, useState } from "react";
import { C, VizCard, Ctl, Stat, Toggle } from "./kit";

// ~unit-gaussian offsets, fixed so the scatter is deterministic (no hydration drift)
const UNIT: [number, number][] = [
  [0.12, -0.34], [-0.55, 0.2], [0.8, 0.44], [-0.28, -0.72],
  [0.4, 0.95], [-0.9, -0.25], [0.62, -0.58], [0.05, 0.3],
  [-0.42, 0.66], [0.33, -0.15], [-0.7, -0.6], [0.95, 0.1],
  [-0.15, 0.85], [0.5, 0.4], [-0.62, -0.05], [0.22, -0.9],
];

const W = 360;
const H = 300;
const CX = 180;
const CY = 150;
const PX_PER_DEG = 46; // target radius R = 1.0° → 46px
const SIG0 = 0.06;
const SIGV = 0.0022;

export default function SignalNoiseLab() {
  const [v, setV] = useState(300);
  const [correct, setCorrect] = useState(true);
  const R = 1.0; // target radius in degrees
  const sd = SIG0 + SIGV * v; // signal-dependent noise (degrees)

  const shots = useMemo(() => {
    return UNIT.map(([ox, oy]) => {
      const dx0 = ox * sd;
      const dy0 = oy * sd;
      const d0 = Math.hypot(dx0, dy0);
      let dx = dx0,
        dy = dy0,
        d = d0,
        state: "hit" | "miss" | "timeout" = d0 <= R ? "hit" : "miss";
      let corrected = false;
      if (correct && d0 > R) {
        if (d0 <= 2.0 * R) {
          // a corrective submovement pulls it inside
          const k = (0.55 * R) / d0;
          dx = dx0 * k;
          dy = dy0 * k;
          d = 0.55 * R;
          state = "hit";
          corrected = true;
        } else {
          state = "timeout"; // too far to rescue before the shot times out
        }
      }
      return { dx0, dy0, dx, dy, d0, d, state, corrected };
    });
  }, [sd, correct, R]);

  const hits = shots.filter((s) => s.state === "hit").length;
  const nCorr = shots.filter((s) => s.corrected).length;
  const hitPct = Math.round((hits / shots.length) * 100);

  const px = (deg: number) => deg * PX_PER_DEG;

  return (
    <VizCard
      title="the noise you can't see"
      hint="drag the speed →"
      caption={
        <>
          fig — signal-dependent noise, live. endpoint spread grows{" "}
          <em>linearly</em> with flick speed (Meyer 1988; Harris &amp; Wolpert
          1998). corrections rescue the near-misses — the thin lines are the
          corrective submovements — but the far ones time out. this is the whole
          diagnostic premise in one picture.
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full font-sans"
          fontWeight={500}
          role="img"
          aria-label={`Shot scatter on a target at ${Math.round(v)} degrees per second flick speed, ${hitPct} percent hits`}
        >
          {/* rings */}
          <circle cx={CX} cy={CY} r={px(2)} fill="none" stroke={C.lineA(0.6)} strokeDasharray="3 4" />
          <circle cx={CX} cy={CY} r={px(R)} fill={C.hitA(0.08)} stroke={C.hit} strokeWidth={1.5} />
          <line x1={CX - 8} y1={CY} x2={CX + 8} y2={CY} stroke={C.faint} />
          <line x1={CX} y1={CY - 8} x2={CX} y2={CY + 8} stroke={C.faint} />
          <text x={CX + px(R) + 4} y={CY - 4} fontSize={11} fill={C.hit}>
            hit window
          </text>
          {/* shots */}
          {shots.map((s, i) => {
            const x = CX + px(s.dx);
            const y = CY + px(s.dy);
            const x0 = CX + px(s.dx0);
            const y0 = CY + px(s.dy0);
            const col = s.state === "hit" ? C.hit : C.rust;
            return (
              <g key={i}>
                {s.corrected && (
                  <line x1={x0} y1={y0} x2={x} y2={y} stroke={C.acc} strokeWidth={1.1} opacity={0.65} />
                )}
                <g style={{ transform: `translate(${x}px,${y}px)`, transition: "transform .45s cubic-bezier(.2,.7,.2,1)" }}>
                  {s.state === "timeout" ? (
                    <circle r={4} fill="none" stroke={col} strokeWidth={1.5} />
                  ) : (
                    <circle r={4} fill={col} />
                  )}
                </g>
              </g>
            );
          })}
        </svg>

        <div className="space-y-4">
          <Ctl
            label="flick speed"
            value={v}
            min={40}
            max={700}
            step={5}
            onChange={setV}
            fmt={(x) => `${Math.round(x)} °/s`}
          />
          <div className="flex items-center justify-between">
            <span className="font-sans text-sm font-medium text-ink-soft">corrections</span>
            <Toggle on={correct} onClick={() => setCorrect((s) => !s)}>
              {correct ? "on" : "off"}
            </Toggle>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-line/70 pt-3">
            <Stat value={`${sd.toFixed(2)}°`} label="endpoint SD" color={C.pur} />
            <Stat value={`${hitPct}%`} label="hits" color={hitPct >= 68 ? C.hit : C.rust} />
            <Stat value={`${nCorr}`} label="corrections used" color={C.acc} />
            <Stat value={`${shots.length}`} label="shots" color={C.faint} />
          </div>
        </div>
      </div>
    </VizCard>
  );
}
