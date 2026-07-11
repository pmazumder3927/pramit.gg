"use client";

// How the coach picks difficulty. P(success) = σ(skill − demand). Slide your
// skill and a drill's demand; the "solve" button inverts the model and animates
// the drill's demand until predicted success lands on an assumed learning peak.
// 0.70 is OpenAim's cold-start prior, not a universal motor-learning constant.

import { useEffect, useRef, useState } from "react";
import { C, VizCard, Ctl, Stat, Btn, sigmoid } from "./kit";

const W = 470;
const H = 300;
const X0 = 56;
const X1 = 444;
const Y0 = 250; // P = 0
const Y1 = 40; // P = 1
const G = 6; // g axis spans [-G, G]
const xOf = (g: number) => X0 + ((g + G) / (2 * G)) * (X1 - X0);
const yOf = (p: number) => Y0 - p * (Y0 - Y1);

const CURVE = Array.from({ length: 61 }, (_, i) => {
  const g = -G + (i / 60) * (2 * G);
  return `${i === 0 ? "M" : "L"}${xOf(g).toFixed(1)},${yOf(sigmoid(g)).toFixed(1)}`;
}).join(" ");

export default function ChallengePoint() {
  const [skill, setSkill] = useState(3.2);
  const [demand, setDemand] = useState(1.4);
  const [target, setTarget] = useState(0.7);
  const raf = useRef<number | null>(null);

  const g = skill - demand;
  const p = sigmoid(g);
  const targetGap = Math.log(target / (1 - target));

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const solve = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const solvedDemand = Math.min(G, Math.max(-1, skill - targetGap));
    const from = demand;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setDemand(solvedDemand); return; }
    const t0 = performance.now();
    const dur = 520;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setDemand(from + (solvedDemand - from) * e);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  return (
    <VizCard
      title="how hard should the next drill be?"
      hint="0.70 is a starting prior"
      caption={
        <>
          fig — the coach fits P(success) = σ(skill − demand) over the whole
          demand space, then <em>inverts</em> it: it solves a drill's geometry
          toward an assumed learning peak. OpenAim starts at 0.70; the coach
          treats that as a prior to learn per player, not a number the
          literature handed down (Guadagnoli &amp; Lee 2004; Pelánek 2016).
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Logistic success curve; current predicted success ${Math.round(p * 100)} percent`}>
          {/* axes */}
          <line x1={X0} y1={Y1} x2={X0} y2={Y0} stroke={C.lineA(0.8)} />
          <line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke={C.lineA(0.8)} />
          <text x={16} y={(Y0 + Y1) / 2} fontSize={10} fill={C.faint} transform={`rotate(-90 16 ${(Y0 + Y1) / 2})`} textAnchor="middle" fontFamily="var(--font-caveat), cursive">P(success)</text>
          <text x={(X0 + X1) / 2} y={H - 8} fontSize={10} fill={C.faint} textAnchor="middle" fontFamily="var(--font-caveat), cursive">skill − demand →</text>
          {/* gridlines P=0/0.5/1 */}
          {[0, 0.5, 1].map((pp) => (
            <line key={pp} x1={X0} y1={yOf(pp)} x2={X1} y2={yOf(pp)} stroke={C.lineA(0.4)} strokeDasharray="2 4" />
          ))}
          {/* challenge point band */}
          <line x1={X0} y1={yOf(target)} x2={X1} y2={yOf(target)} stroke={C.hit} strokeDasharray="5 4" />
          <text x={X1} y={yOf(target) - 5} fontSize={9} fill={C.hit} textAnchor="end" fontFamily="var(--font-caveat), cursive">assumed peak = {target.toFixed(2)}</text>
          <line x1={xOf(targetGap)} y1={Y1} x2={xOf(targetGap)} y2={Y0} stroke={C.hitA(0.5)} strokeDasharray="3 3" />

          {/* sigmoid */}
          <path d={CURVE} fill="none" stroke={C.pur} strokeWidth={2.4} />

          {/* current point */}
          <line x1={xOf(g)} y1={yOf(p)} x2={xOf(g)} y2={Y0} stroke={C.accA(0.4)} strokeDasharray="3 3" />
          <circle cx={xOf(g)} cy={yOf(p)} r={7} fill={C.acc} stroke="rgb(var(--surface))" strokeWidth={2} />
        </svg>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat value={`${Math.round(p * 100)}%`} label="predicted success" color={Math.abs(p - target) < 0.05 ? C.hit : C.acc} />
            <Stat value={g.toFixed(2)} label="skill − demand" color={C.faint} />
          </div>
          <Btn onClick={solve}>solve to {Math.round(target * 100)}% →</Btn>
          <div className="space-y-3 border-t border-line/70 pt-3">
            <Ctl label="your skill" value={skill} min={0} max={6} step={0.1} onChange={setSkill} fmt={(x) => x.toFixed(1)} accent={C.acc} />
            <Ctl label="drill demand" value={demand} min={-1} max={6} step={0.1} onChange={setDemand} fmt={(x) => x.toFixed(1)} accent={C.pur} />
            <Ctl label="assumed learning peak" value={target} min={0.5} max={0.9} step={0.01} onChange={setTarget} fmt={(x) => `${Math.round(x * 100)}%`} accent={C.hit} />
          </div>
        </div>
      </div>
    </VizCard>
  );
}
