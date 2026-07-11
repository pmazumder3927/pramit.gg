"use client";

// The capability radar. 14 cited demand axes; a baseline "ghost" polygon under
// the live "now" polygon. Click an axis to read its actual feature formula and
// citation; hit "run a session" to watch the weakest axes improve most (the
// learning-progress idea), animated.

import { useEffect, useRef, useState } from "react";
import { C, VizCard, Btn, Toggle } from "./kit";

type Axis = { short: string; what: string; formula: string; cite: string; now: number };

const AXES: Axis[] = [
  { short: "fitts", what: "spatial precision — the classic index of difficulty, sens-invariant by design", formula: "log₂(A/W + 1)", cite: "Fitts; Harris & Wolpert 1998", now: 0.72 },
  { short: "temporal", what: "interception timing — crossing rate ≈ inverse click window", formula: "v / (10·W)", cite: "ICP, Lee et al. 2020", now: 0.55 },
  { short: "reactivity", what: "reactive correction to unpredictable motion", formula: "λ·v / (15·W)", cite: "Servo-Gaussian, Park 2020", now: 0.41 },
  { short: "stability", what: "sustained on-target hold", formula: "holdS·(1 + v/10W) / 2", cite: "tracking hold", now: 0.6 },
  { short: "switching", what: "simultaneous-target planning load", formula: "(n − 1) / 2", cite: "multi-target", now: 0.5 },
  { short: "vertical", what: "vertical spread / motion, jump-aware", formula: "vEff / 0.4", cite: "—", now: 0.66 },
  { short: "armControl", what: "hand-space travel per flick — arm recruitment", formula: "ln( A·cm360/360 ÷ 3.5 )", cite: "SDN in motor coords", now: 0.58 },
  { short: "microControl", what: "hand-space finger-scale flicks", formula: "ln( 1.2 ÷ A·cm360/360 )", cite: "SDN in motor coords", now: 0.38 },
  { short: "handPrecision", what: "hand-space endpoint precision (fine hand)", formula: "ln( 0.28 ÷ W·cm360/360 )", cite: "SDN in motor coords", now: 0.44 },
  { short: "handSpeed", what: "hand-space required hand velocity", formula: "ln( v·cm360/360 ÷ 1.5 )", cite: "SDN in motor coords", now: 0.63 },
  { short: "pace", what: "time pressure (signed — relaxed goes negative)", formula: "ln(1/pace) / 0.25", cite: "—", now: 0.52 },
  { short: "smoothPursuit", what: "predictable pursuit, dissociated from reactivity", formula: "1.4·smooth·(1−λ)⁺·v/10W", cite: "Servo-Gaussian, Park 2020", now: 0.7 },
  { short: "reacquire", what: "post-blink / displacement re-lock", formula: "dash·(1 + A/16)", cite: "submovement re-plan", now: 0.36 },
  { short: "cadence", what: "repeat-shot commitment at a rhythm", formula: "((hp − 1)/2)·(1 + v/10W)", cite: "ICP internal clock", now: 0.48 },
];

const N = AXES.length;
const CX = 210;
const CY = 205;
const RAD = 150;

const pt = (i: number, val: number) => {
  const a = ((-90 + (i * 360) / N) * Math.PI) / 180;
  // V8 can differ at the last floating-point bit between server and browser.
  // Stabilize SVG attributes so React hydration sees identical coordinates.
  return [
    Number((CX + Math.cos(a) * RAD * val).toFixed(10)),
    Number((CY + Math.sin(a) * RAD * val).toFixed(10)),
  ] as const;
};
const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ");

export default function CapabilityRadar() {
  const baseline = useRef(AXES.map((a) => a.now));
  const [now, setNow] = useState<number[]>(() => AXES.map((a) => a.now));
  const [showGhost, setShowGhost] = useState(true);
  const [sel, setSel] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const runSession = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const from = [...now];
    // weakest axes improve most — learning progress routed where marginal return is highest
    const target = from.map((v) => Math.min(0.98, v + 0.05 + 0.16 * (1 - v)));
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setNow(target); return; }
    const t0 = performance.now();
    const dur = 900;
    const step = (n: number) => {
      const k = Math.min(1, (n - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setNow(from.map((v, i) => v + (target[i] - v) * e));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  const reset = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    setNow([...baseline.current]);
  };

  const a = AXES[sel];

  return (
    <VizCard
      title="the shape of your aim"
      hint="click an axis · run a session"
      caption={
        <>
          fig — the real capability radar. fourteen cited demand axes, each on
          one Elo-style scale, with a baseline ghost so you can see what actually
          moved. every spoke links to its formula and citation — this is the
          "power meter" read-out, not a single number.
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
        <svg viewBox="0 0 420 420" className="mx-auto w-full max-w-[26rem]" role="img" aria-label="14-axis capability radar">
          {/* rings */}
          {[0.25, 0.5, 0.75, 1].map((r) => (
            <circle key={r} cx={CX} cy={CY} r={RAD * r} fill="none" stroke={C.lineA(0.5)} />
          ))}
          {/* spokes + labels */}
          {AXES.map((ax, i) => {
            const [ex, ey] = pt(i, 1);
            const [lx, ly] = pt(i, 1.15);
            const active = i === sel;
            return (
              <g key={ax.short}>
                <line x1={CX} y1={CY} x2={ex} y2={ey} stroke={C.lineA(0.5)} />
                <text
                  x={lx}
                  y={ly}
                  fontSize={9}
                  fill={active ? C.acc : C.faint}
                  fontWeight={active ? 700 : 400}
                  textAnchor={lx < CX - 6 ? "end" : lx > CX + 6 ? "start" : "middle"}
                  dominantBaseline="middle"
                  fontFamily="var(--font-caveat), cursive"
                  className="cursor-pointer"
                  onClick={() => setSel(i)}
                >
                  {ax.short}
                </text>
              </g>
            );
          })}
          {/* ghost baseline */}
          {showGhost && (
            <polygon points={poly(baseline.current)} fill="none" stroke={C.faint} strokeWidth={1.4} strokeDasharray="4 3" opacity={0.8} />
          )}
          {/* now */}
          <polygon points={poly(now)} fill={C.accA(0.14)} stroke={C.acc} strokeWidth={2} />
          {/* vertices */}
          {now.map((v, i) => {
            const [x, y] = pt(i, v);
            return <circle key={i} cx={x} cy={y} r={i === sel ? 5 : 3} fill={i === sel ? C.acc : C.accA(0.7)} className="cursor-pointer" onClick={() => setSel(i)} />;
          })}
        </svg>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Btn onClick={runSession}>run a session →</Btn>
            <Toggle on={showGhost} onClick={() => setShowGhost((s) => !s)}>ghost</Toggle>
            <button type="button" onClick={reset} className="font-hand text-lg text-ink-faint underline decoration-dotted underline-offset-4 hover:text-accent-rust">reset</button>
          </div>
          <div className="rounded-lg border border-line/70 bg-paper-2/40 p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-base" style={{ color: C.acc }}>{a.short}</span>
              <span className="font-mono text-sm text-ink">{Math.round(now[sel] * 100)}</span>
            </div>
            <p className="mt-1.5 font-hand text-lg leading-snug text-ink-soft">{a.what}</p>
            <div className="mt-2 rounded bg-ink/[0.05] px-2 py-1 font-mono text-xs text-accent-rust">{a.formula}</div>
            <p className="mt-1.5 font-hand text-base text-ink-faint">{a.cite}</p>
          </div>
        </div>
      </div>
    </VizCard>
  );
}
