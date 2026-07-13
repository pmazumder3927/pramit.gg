"use client";

// "one flick, decomposed" — an interactive playback of a single REAL captured
// engagement (see flickFixture.ts), not a hand-drawn illustration. The scope
// panel replays the crosshair's actual path through the target-local frame;
// the phase coloring (reaction/ballistic/correction/settle) and the two
// charts underneath come straight from the same segmenter that runs live in
// the replay viewer (src/replay/kinematics.ts) — nothing here is guessed.

import { useEffect, useRef, useState } from "react";
import { FLICK_FIXTURE, type PhaseCode } from "./flickFixture";
import { C, Stat, VizCard } from "./kit";

const f = FLICK_FIXTURE;
const path = f.path;

const PHASE_COLOR: Record<PhaseCode, string> = {
  0: C.faint,
  1: C.acc,
  2: C.pur,
  3: C.hit,
};
const PHASE_TITLE: Record<PhaseCode, string> = {
  0: "reaction",
  1: "ballistic launch",
  2: "correction",
  3: "settle",
};

// Contiguous phase runs — the segmenter produced exactly one of each, in
// order, for this engagement (reaction → ballistic → correction → settle).
interface Run {
  phase: PhaseCode;
  start: number;
  end: number;
}
const RUNS: Run[] = (() => {
  const runs: Run[] = [];
  let start = 0;
  for (let i = 1; i <= path.length; i++) {
    if (i === path.length || path[i]![5] !== path[start]![5]) {
      runs.push({ phase: path[start]![5], start, end: i - 1 });
      start = i;
    }
  }
  return runs;
})();

/** Build one path per phase run, each clipped to `uptoIdx` and bridged to the
 * previous run's last point so segments join with no visible gap. */
function runPaths(uptoIdx: number, mapPoint: (p: (typeof path)[number]) => [number, number]) {
  const out: Array<{ phase: PhaseCode; d: string }> = [];
  for (const run of RUNS) {
    if (run.start > uptoIdx) break;
    const from = Math.max(0, run.start - 1);
    const to = Math.min(run.end, uptoIdx);
    if (to < from) continue;
    let d = "";
    for (let i = from; i <= to; i++) {
      const [x, y] = mapPoint(path[i]!);
      d += `${i === from ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    out.push({ phase: run.phase, d });
  }
  return out;
}

// ---- scope geometry (target fixed at the origin, crosshair moves) ---------
const SCOPE_W = 640;
const MARGIN_X = 50;
const MARGIN_Y = 50;
const PAD_DEG = 3;
const uVals = path.map((p) => p[3]);
const vVals = path.map((p) => p[4]);
const uMin = Math.min(...uVals);
const uMax = Math.max(...uVals);
const vMin = Math.min(...vVals);
const vMax = Math.max(...vVals);
const PX_PER_DEG = (SCOPE_W - 2 * MARGIN_X) / (uMax - uMin + 2 * PAD_DEG);
const SCOPE_H = Math.round((vMax - vMin + 2 * PAD_DEG) * PX_PER_DEG + 2 * MARGIN_Y);
const CENTER_U = (uMin + uMax) / 2;
const CENTER_V = (vMin + vMax) / 2;
const scopeX = (u: number) => SCOPE_W / 2 + (u - CENTER_U) * PX_PER_DEG;
const scopeY = (v: number) => SCOPE_H / 2 - (v - CENTER_V) * PX_PER_DEG;
const targetR = f.targetRadiusDeg * PX_PER_DEG;

// ---- chart geometry (speed on top, error below, shared time axis) ---------
const CW = 640;
const x0 = 60;
const x1 = CW - 20;
const xAt = (t: number) => x0 + (t / f.acquireMs) * (x1 - x0);
const speedTop = 30;
const speedBase = 130;
const speedScaleMax = 260; // deg/s headroom above the recorded peak (228)
const ySpeed = (s: number) => speedBase - (Math.min(s, speedScaleMax) / speedScaleMax) * (speedBase - speedTop);
const errTop = 160;
const errBase = 245;
const errScaleMax = 22; // deg headroom above the recorded amplitude (20)
const yErr = (e: number) => errBase - (Math.min(e, errScaleMax) / errScaleMax) * (errBase - errTop);
const errPxPerDeg = (errBase - errTop) / errScaleMax;
const hitH = f.targetRadiusDeg * errPxPerDeg;

const SLOWDOWN = 4; // real flick is 542 ms — play it back 4x slower to actually see it

export default function FlickAnatomy() {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timeRef = useRef(0);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    if (!playing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPlaying(false);
      return;
    }
    const epoch = performance.now() - timeRef.current * SLOWDOWN;
    let raf = 0;
    const tick = (now: number) => {
      const next = ((now - epoch) / SLOWDOWN) % f.acquireMs;
      timeRef.current = next;
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const idx = Math.min(path.length - 1, Math.max(0, Math.round((time / f.acquireMs) * (path.length - 1))));
  const cur = path[idx]!;
  const curPhase = cur[5];
  const playheadX = xAt(cur[0]);

  const scopeSegs = runPaths(idx, (p) => [scopeX(p[3]), scopeY(p[4])]);
  const speedSegs = runPaths(idx, (p) => [xAt(p[0]), ySpeed(p[1])]);
  const errSegs = runPaths(idx, (p) => [xAt(p[0]), yErr(p[2])]);

  const legend = RUNS.map((run) => ({
    phase: run.phase,
    startMs: path[run.start]![0],
    endMs: path[run.end]![0],
  }));

  return (
    <VizCard
      title="one flick, decomposed"
      hint="a real capture — press play"
      caption={
        <>
          fig — one actual engagement, replayed from a captured .oar file:
          {" "}{f.amplitudeDeg}° amplitude, {Math.round(f.peakSpeed)}°/s peak
          crosshair speed, killed {Math.round(f.acquireMs)} ms after spawn.
          the four phases below are the segmenter&apos;s own output — reaction,
          ballistic launch, correction, settle — not hand-picked. played back
          {" "}{SLOWDOWN}× slower than it actually happened.
        </>
      }
    >
      <div className="space-y-4">
        <div className="overflow-hidden border border-line bg-paper-2/40">
          <svg
            viewBox={`0 0 ${SCOPE_W} ${SCOPE_H}`}
            className="block w-full font-sans"
            role="img"
            aria-label="Top-down scope replay of a real captured flick: the crosshair launches toward a static target, overshoots slightly, then corrects back onto it."
          >
            <defs>
              <pattern id="flick-scope-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke={C.lineA(0.35)} strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={SCOPE_W} height={SCOPE_H} fill={C.lineA(0.08)} />
            <rect width={SCOPE_W} height={SCOPE_H} fill="url(#flick-scope-grid)" />

            {/* target, fixed at the origin */}
            <circle cx={scopeX(0)} cy={scopeY(0)} r={targetR + 6} fill={C.hitA(0.1)} stroke={C.hitA(0.4)} strokeWidth="1" />
            <circle cx={scopeX(0)} cy={scopeY(0)} r={targetR} fill={C.hitA(0.82)} stroke={C.ink} strokeWidth="1.5" />

            {/* trail, colored by the segmenter's own phase labels */}
            {scopeSegs.map((seg, i) => (
              <path key={i} d={seg.d} fill="none" stroke={PHASE_COLOR[seg.phase]} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
            ))}

            {/* line from the live crosshair position to the target, echoing "error" */}
            <line x1={scopeX(cur[3])} y1={scopeY(cur[4])} x2={scopeX(0)} y2={scopeY(0)} stroke={C.lineA(0.6)} strokeDasharray="3 3" />

            {/* the moving crosshair itself */}
            <g transform={`translate(${scopeX(cur[3])} ${scopeY(cur[4])})`}>
              <line x1="-13" x2="-4" stroke={PHASE_COLOR[curPhase]} strokeWidth="2.4" />
              <line x1="4" x2="13" stroke={PHASE_COLOR[curPhase]} strokeWidth="2.4" />
              <line y1="-13" y2="-4" stroke={PHASE_COLOR[curPhase]} strokeWidth="2.4" />
              <line y1="4" y2="13" stroke={PHASE_COLOR[curPhase]} strokeWidth="2.4" />
              <circle r="2" fill={PHASE_COLOR[curPhase]} />
            </g>

            <g className="font-mono text-[22px] sm:text-[13px]">
              <text x="14" y="26" fill={PHASE_COLOR[curPhase]} fontWeight={600}>{PHASE_TITLE[curPhase].toUpperCase()}</text>
              <text x={SCOPE_W - 14} y="26" textAnchor="end" fill={C.faint}>err {cur[2].toFixed(2)}°</text>
              <text x="14" y={SCOPE_H - 14} fill={C.faint}>{cur[0].toFixed(0)} / {f.acquireMs.toFixed(0)} ms</text>
              <text x={SCOPE_W - 14} y={SCOPE_H - 14} textAnchor="end" fill={C.faint}>{f.scenario}</text>
            </g>
          </svg>

          <div className="flex items-center gap-3 border-t border-line px-3 py-2">
            <button
              type="button"
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? "Pause replay" : "Play replay"}
              title={playing ? "Pause replay" : "Play replay"}
              className="grid h-8 w-8 shrink-0 place-items-center border border-accent-orange/50 font-mono text-sm text-accent-orange"
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <input
              type="range"
              min={0}
              max={f.acquireMs}
              step={1}
              value={time}
              onChange={(e) => {
                const v = Number(e.target.value);
                timeRef.current = v;
                setTime(v);
              }}
              aria-label="Replay position"
              className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-line"
              style={{ accentColor: C.acc }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {legend.map((l) => (
            <div
              key={l.phase}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors"
              style={{
                borderColor: l.phase === curPhase ? PHASE_COLOR[l.phase] : C.lineA(0.7),
                background: l.phase === curPhase ? C.lineA(0.08) : "transparent",
              }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: PHASE_COLOR[l.phase] }} />
              <span className="font-sans text-xs font-medium text-ink-soft">{PHASE_TITLE[l.phase]}</span>
              <span className="font-mono text-xs text-ink-faint">{Math.round(l.endMs - l.startMs)}ms</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-line/70 py-3 sm:grid-cols-4">
          <Stat value={`${f.amplitudeDeg}°`} label="amplitude" color={C.acc} />
          <Stat value={`${Math.round(f.peakSpeed)}°/s`} label="peak speed" color={C.acc} />
          <Stat value={`${f.overshoot >= 0 ? "+" : ""}${Math.round(f.overshoot * 100)}%`} label="overshoot" color={C.pur} />
          <Stat value={String(f.nSubmovements)} label="submovements" color={C.pur} />
        </div>

        <svg viewBox={`0 0 ${CW} 260`} className="w-full font-sans" fontWeight={500} role="img" aria-label="Mouse speed and crosshair error over the same flick, colored by phase, with a playhead synced to the scope above.">
          <text x="18" y="80" fill={C.faint} transform="rotate(-90 18 80)" textAnchor="middle" className="text-[18px] sm:text-[11px]">mouse speed</text>
          <line x1={x0} y1={speedTop} x2={x0} y2={speedBase} stroke={C.lineA(0.8)} />
          <line x1={x0} y1={speedBase} x2={x1} y2={speedBase} stroke={C.lineA(0.8)} />
          {speedSegs.map((seg, i) => (
            <path key={i} d={seg.d} fill="none" stroke={PHASE_COLOR[seg.phase]} strokeWidth="2.2" strokeLinejoin="round" />
          ))}

          <text x="18" y="205" fill={C.faint} transform="rotate(-90 18 205)" textAnchor="middle" className="text-[18px] sm:text-[11px]">crosshair error</text>
          <line x1={x0} y1={errTop} x2={x0} y2={errBase} stroke={C.lineA(0.8)} />
          <line x1={x0} y1={errBase} x2={x1} y2={errBase} stroke={C.lineA(0.8)} />
          <rect x={x0} y={errBase - hitH} width={x1 - x0} height={hitH} fill={C.hitA(0.2)} />
          <text x={x1 - 4} y={errBase - hitH - 6} fill={C.hit} textAnchor="end" className="text-[15px] sm:text-[10px]">hit window ({f.targetRadiusDeg}°)</text>
          {errSegs.map((seg, i) => (
            <path key={i} d={seg.d} fill="none" stroke={PHASE_COLOR[seg.phase]} strokeWidth="2.2" strokeLinejoin="round" />
          ))}

          <line x1={playheadX} y1={speedTop} x2={playheadX} y2={speedBase} stroke={C.ink} strokeWidth="1.5" opacity="0.55" />
          <line x1={playheadX} y1={errTop} x2={playheadX} y2={errBase} stroke={C.ink} strokeWidth="1.5" opacity="0.55" />
          <circle cx={playheadX} cy={ySpeed(cur[1])} r="3.5" fill={C.ink} />
          <circle cx={playheadX} cy={yErr(cur[2])} r="3.5" fill={C.ink} />

          <text x={(CW + 40) / 2} y="254" fill={C.faint} textAnchor="middle" className="text-[15px] sm:text-[10px]">time after target appears →</text>
        </svg>
      </div>
    </VizCard>
  );
}
