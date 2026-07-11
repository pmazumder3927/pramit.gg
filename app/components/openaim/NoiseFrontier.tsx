"use client";

// The headline chart, made playable. Tune your motor-noise slope σᵥ and target
// size; drag your operating point along the speed axis. It computes where your
// error line crosses the target radius (your frontier) and a hit-rate from a
// Rayleigh model, then tells you to speed up or slow down.

import { useState } from "react";
import { C, VizCard, Ctl, Stat, useSvgDragX } from "./kit";

const W = 470;
const H = 300;
const X0 = 60;
const X1 = 442;
const Y0 = 250; // sd = 0
const Y1 = 40; // sd = SD_MAX
const V_MAX = 900; // deg/s
const SD_MAX = 2.0; // deg
const SIG0 = 0.05;

const xOf = (v: number) => X0 + (v / V_MAX) * (X1 - X0);
const yOf = (sd: number) => Y0 + (Math.min(sd, SD_MAX) / SD_MAX) * (Y1 - Y0);

export default function NoiseFrontier() {
  const [sigv, setSigv] = useState(0.0018);
  const [R, setR] = useState(1.0);
  const [vOp, setVOp] = useState(300);

  const sdAt = (v: number) => SIG0 + sigv * v;
  const sdOp = sdAt(vOp);
  const frontier = (R - SIG0) / sigv; // speed where the line hits the radius
  const hitRate = 1 - Math.exp(-(R * R) / (2 * sdOp * sdOp)); // Rayleigh P(inside R)
  const ratio = vOp / frontier;

  const verdict =
    ratio < 0.75
      ? { t: "speed up — you've got headroom", c: C.hit }
      : ratio <= 1.05
        ? { t: "right at your edge", c: C.acc }
        : { t: "you're outrunning your precision — slow down", c: C.rust };

  const drag = useSvgDragX(X0, X1, (f) => setVOp(Math.round(f * V_MAX)));

  const fClamped = Math.min(frontier, V_MAX);

  return (
    <VizCard
      title="find your frontier"
      hint="drag the point · tune σᵥ"
      caption={
        <>
          fig — your speed–accuracy frontier. the slope σᵥ is the single most
          useful number in the profile: it sets the fastest you can flick before
          neural noise, not skill, decides the outcome. where your operating
          point sits relative to the frontier is the whole prescription.
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
        <svg
          ref={drag.ref}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none cursor-ew-resize font-sans"
          fontWeight={500}
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          role="img"
          aria-label={`Speed accuracy frontier. You flick at ${Math.round(vOp)} degrees per second, hit rate ${Math.round(hitRate * 100)} percent.`}
        >
          {/* axes */}
          <line x1={X0} y1={Y1} x2={X0} y2={Y0} stroke={C.lineA(0.8)} />
          <line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke={C.lineA(0.8)} />
          <text x={16} y={(Y0 + Y1) / 2} fontSize={11} fill={C.faint} transform={`rotate(-90 16 ${(Y0 + Y1) / 2})`} textAnchor="middle">endpoint SD °</text>
          <text x={(X0 + X1) / 2} y={H - 8} fontSize={11} fill={C.faint} textAnchor="middle">flick speed °/s →</text>

          {/* target radius line */}
          <line x1={X0} y1={yOf(R)} x2={X1} y2={yOf(R)} stroke={C.hit} strokeDasharray="5 4" />
          <text x={X1} y={yOf(R) - 5} fontSize={10} fill={C.hit} textAnchor="end">target radius — miss above</text>

          {/* noise line σ0 + σv·v */}
          <line x1={xOf(0)} y1={yOf(sdAt(0))} x2={xOf(V_MAX)} y2={yOf(sdAt(V_MAX))} stroke={C.pur} strokeWidth={2.4} />

          {/* frontier crossing */}
          {frontier > 0 && frontier <= V_MAX && (
            <>
              <circle cx={xOf(fClamped)} cy={yOf(R)} r={5.5} fill="none" stroke={C.hit} strokeWidth={2} />
              <text x={xOf(fClamped)} y={yOf(R) + 18} fontSize={10} fill={C.hit} textAnchor="middle">frontier</text>
            </>
          )}
          {frontier > V_MAX && (
            <text x={X1 - 4} y={Y1 + 14} fontSize={10} fill={C.hit} textAnchor="end">frontier &gt; {V_MAX} °/s ↗</text>
          )}

          {/* operating point */}
          <line x1={xOf(vOp)} y1={Y1} x2={xOf(vOp)} y2={Y0} stroke={C.accA(0.5)} strokeDasharray="3 3" />
          <circle cx={xOf(vOp)} cy={yOf(sdOp)} r={7} fill={C.acc} stroke="rgb(var(--surface))" strokeWidth={2} />
          <text x={xOf(vOp)} y={Y1 + 2} fontSize={10} fill={C.acc} textAnchor="middle">you</text>
        </svg>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat value={`${Math.round(vOp)}`} label="your flick °/s" color={C.acc} />
            <Stat value={`${Math.round(hitRate * 100)}%`} label="predicted hits" color={hitRate >= 0.68 ? C.hit : C.rust} />
            <Stat value={frontier > V_MAX ? `>${V_MAX}` : `${Math.round(frontier)}`} label="frontier °/s" color={C.pur} />
            <Stat value={`${sdOp.toFixed(2)}°`} label="your SD" color={C.faint} />
          </div>
          <div
            className="rounded-lg border px-3 py-2 font-sans text-sm font-medium leading-snug"
            style={{ borderColor: verdict.c, color: verdict.c, background: C.accA(0.06) }}
          >
            {verdict.t}
          </div>
          <div className="space-y-3 border-t border-line/70 pt-3">
            <Ctl label="your motor-noise σᵥ" value={sigv} min={0.0008} max={0.0035} step={0.0001} onChange={setSigv} fmt={(x) => `${(x * 1000).toFixed(1)}/1k`} accent={C.pur} />
            <Ctl label="target radius" value={R} min={0.4} max={1.6} step={0.05} onChange={setR} fmt={(x) => `${x.toFixed(2)}°`} accent={C.hit} />
          </div>
        </div>
      </div>
    </VizCard>
  );
}
