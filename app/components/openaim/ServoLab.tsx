"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { C, Ctl, Stat, VizCard } from "./kit";

type Motion = "readable" | "reversals";
type NoiseLaw = "gaussian" | "lapses";
type Sample = { t: number; target: number; cursor: number; onTarget: boolean };

const W = 640;
const H = 300;
const DURATION_MS = 12_000;
const DT = 1000 / 60;

function targetAt(tMs: number, motion: Motion) {
  const t = tMs / 1000;
  if (motion === "readable") return 0.78 * Math.sin(t * 1.22);
  return (
    0.52 * Math.sin(t * 1.62 + 0.2) +
    0.2 * Math.sin(t * 4.37 + 1.1) +
    0.08 * Math.sin(t * 9.1)
  );
}

function gaussian(index: number) {
  const u = Math.max(1e-6, ((Math.sin(index * 12.9898 + 0.4) * 43758.5453) % 1 + 1) % 1);
  const v = Math.max(1e-6, ((Math.sin(index * 78.233 + 2.1) * 19341.167) % 1 + 1) % 1);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simulate(motion: Motion, delayMs: number, widthPx: number, noise: number, law: NoiseLaw) {
  const tolerance = widthPx / 250;
  const samples: Sample[] = [];
  let cursor = 0;
  let moveFrom = 0;
  let moveTo = 0;
  let moveStart = 0;
  let moveEnd = 0;
  let nextCorrection = 0;
  let correction = 0;

  for (let t = 0; t <= DURATION_MS; t += DT) {
    if (t >= nextCorrection - 1e-6) {
      const target = targetAt(t, motion);
      const earlier = targetAt(Math.max(0, t - 40), motion);
      const velocity = (target - earlier) / 0.04;
      const predictionS = motion === "readable" ? (delayMs / 1000) * 0.72 : (delayMs / 1000) * 0.16;
      const predicted = target + velocity * predictionS;
      const command = predicted - cursor;
      const endpointNoise = gaussian(correction + 1) * noise * (0.025 + Math.abs(command) * 0.09);
      const lapse = law === "lapses" && correction % 7 === 4;

      moveFrom = cursor;
      moveTo = lapse ? cursor : Math.max(-1.05, Math.min(1.05, cursor + command * 0.9 + endpointNoise));
      moveStart = t;
      moveEnd = t + Math.min(125, delayMs * 0.52);
      nextCorrection = t + delayMs;
      correction += 1;
    }

    if (t < moveEnd) {
      const f = Math.max(0, Math.min(1, (t - moveStart) / Math.max(1, moveEnd - moveStart)));
      const eased = f * f * (3 - 2 * f);
      cursor = moveFrom + (moveTo - moveFrom) * eased;
    } else {
      cursor = moveTo;
    }

    const target = targetAt(t, motion);
    samples.push({ t, target, cursor, onTarget: Math.abs(cursor - target) <= tolerance });
  }
  return samples;
}

function stageX(value: number) {
  return 50 + ((value + 1.1) / 2.2) * 540;
}

export default function ServoLab() {
  const [motion, setMotion] = useState<Motion>("readable");
  const [law, setLaw] = useState<NoiseLaw>("gaussian");
  const [delay, setDelay] = useState(260);
  const [width, setWidth] = useState(34);
  const [noise, setNoise] = useState(0.4);
  const [time, setTime] = useState(2400);
  const timeRef = useRef(time);

  const samples = useMemo(
    () => simulate(motion, delay, width, noise, law),
    [delay, law, motion, noise, width],
  );

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const epoch = performance.now() - timeRef.current;
    let raf = 0;
    const tick = (now: number) => {
      const next = (now - epoch) % DURATION_MS;
      timeRef.current = next;
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const index = Math.min(samples.length - 1, Math.floor(time / DT));
  const current = samples[index] ?? samples[0]!;
  const startIndex = Math.max(0, index - Math.round(4000 / DT));
  const trace = samples.slice(startIndex, index + 1);
  const traceStart = trace[0]?.t ?? 0;
  const traceSpan = Math.max(1, (trace[trace.length - 1]?.t ?? 0) - traceStart);
  const plotX = (sample: Sample) => 50 + ((sample.t - traceStart) / traceSpan) * 540;
  const plotY = (value: number) => 218 - value * 52;
  const targetPath = trace.map((sample) => `${plotX(sample).toFixed(1)},${plotY(sample.target).toFixed(1)}`).join(" ");
  const cursorPath = trace.map((sample) => `${plotX(sample).toFixed(1)},${plotY(sample.cursor).toFixed(1)}`).join(" ");
  const recent = samples.slice(Math.max(0, index - Math.round(3000 / DT)), index + 1);
  const onTarget = recent.length ? recent.filter((sample) => sample.onTarget).length / recent.length : 0;
  const error = Math.abs(current.cursor - current.target);

  return (
    <VizCard
      title="the servo-gaussian tracking assumption"
      hint="readable vs. irregular motion"
      caption={
        <>
          fig — a readable toy of the Servo-Gaussian premise: tracking as a
          sequence of delayed corrective movements with roughly Gaussian motor
          error. this is not the paper&apos;s full fitted equation. turn on irregular
          reversals or occasional lapses and the neat assumption starts to come apart;
          that failure is something the model tests for instead of hiding.
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex border border-line" role="group" aria-label="Target motion">
            {(["readable", "reversals"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMotion(value)}
                aria-pressed={motion === value}
                className="px-3 py-1.5 font-mono text-xs"
                style={{
                  color: motion === value ? C.acc : C.faint,
                  background: motion === value ? C.accA(0.1) : "transparent",
                }}
              >
                {value === "readable" ? "predictable sine" : "irregular reversals"}
              </button>
            ))}
          </div>
          <div className="inline-flex border border-line" role="group" aria-label="Noise shape">
            {(["gaussian", "lapses"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLaw(value)}
                aria-pressed={law === value}
                className="px-3 py-1.5 font-mono text-xs"
                style={{
                  color: law === value ? C.pur : C.faint,
                  background: law === value ? C.purA(0.09) : "transparent",
                }}
              >
                {value === "gaussian" ? "Gaussian error" : "add lapses"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden border border-line bg-paper-2/40">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full font-sans"
            role="img"
            aria-label={`Tracking model with ${delay} millisecond correction delay and ${Math.round(onTarget * 100)} percent recent time on target`}
          >
            <defs>
              <pattern id="servo-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke={C.lineA(0.3)} strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#servo-grid)" />
            <line x1="50" x2="590" y1="82" y2="82" stroke={C.lineA(0.8)} />

            <g transform={`translate(${stageX(current.target)} 82)`}>
              <circle r={width / 2 + 4} fill={C.hitA(0.08)} stroke={C.hitA(0.5)} />
              <circle r={width / 2} fill={C.hitA(0.75)} stroke={C.ink} strokeWidth="1.5" />
            </g>
            <g transform={`translate(${stageX(current.cursor)} 82)`} stroke={current.onTarget ? C.acc : C.rust} strokeWidth="2">
              <line x1="-11" x2="-4" />
              <line x1="4" x2="11" />
              <line y1="-11" y2="-4" />
              <line y1="4" y2="11" />
              <circle r="1.5" fill={current.onTarget ? C.acc : C.rust} stroke="none" />
            </g>

            <text x="50" y="122" fill={C.faint} className="font-mono text-[18px] sm:text-[11px]">last four seconds</text>
            {[166, 218, 270].map((y) => (
              <line key={y} x1="50" x2="590" y1={y} y2={y} stroke={C.lineA(0.4)} strokeDasharray="3 4" />
            ))}
            <polyline points={targetPath} fill="none" stroke={C.hit} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={cursorPath} fill="none" stroke={C.pur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <g className="font-mono text-[17px] sm:text-[10px]">
              <text x="590" y="136" textAnchor="end" fill={C.hit}>target</text>
              <text x="590" y="150" textAnchor="end" fill={C.pur}>crosshair</text>
            </g>
          </svg>
        </div>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="space-y-4">
            <Ctl label="corrective delay" value={delay} min={120} max={420} step={10} onChange={setDelay} fmt={(value) => `${value} ms`} />
            <Ctl label="target width" value={width} min={16} max={64} step={2} onChange={setWidth} fmt={(value) => `${value} px`} accent={C.hit} />
            <Ctl label="motor noise" value={noise} min={0} max={1} step={0.05} onChange={setNoise} fmt={(value) => `${Math.round(value * 100)}%`} accent={C.pur} />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-1 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            <Stat value={`${Math.round(onTarget * 100)}%`} label="recently on target" color={onTarget >= 0.68 ? C.hit : C.rust} />
            <Stat value={error.toFixed(2)} label="instant tracking error" color={C.pur} />
          </div>
        </div>
      </div>
    </VizCard>
  );
}
