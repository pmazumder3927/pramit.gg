"use client";

import { useState } from "react";
import { HARNESS_FIXTURE } from "./openaimHarnessFixture";
import { C, Stat, VizCard } from "./kit";

type Engagement = {
  index: number;
  outcome: "kill" | "timeout";
  amplitudeDeg: number;
  targetRadiusDeg: number;
  acquireMs: number;
  peakSpeed: number;
  shots: number;
  killErrDeg: number | null;
};

const run = HARNESS_FIXTURE.clips.find((clip) => clip.id === "tap-honest")!;
const rows = run.engagements as readonly Engagement[];
const W = 640;
const H = 270;
const X0 = 58;
const X1 = 604;
const Y0 = 226;
const Y1 = 35;

const minA = Math.min(...rows.map((row) => row.amplitudeDeg));
const maxA = Math.max(...rows.map((row) => row.amplitudeDeg));
const minT = Math.min(...rows.map((row) => row.acquireMs));
const maxT = Math.max(...rows.map((row) => row.acquireMs));
const meanA = rows.reduce((sum, row) => sum + row.amplitudeDeg, 0) / rows.length;
const meanT = rows.reduce((sum, row) => sum + row.acquireMs, 0) / rows.length;

function xOf(amplitude: number) {
  return X0 + ((amplitude - Math.max(0, minA - 3)) / (maxA - Math.max(0, minA - 3) + 3)) * (X1 - X0);
}

function yOf(time: number) {
  return Y0 - ((time - Math.max(0, minT - 80)) / (maxT - Math.max(0, minT - 80) + 80)) * (Y0 - Y1);
}

export default function LedgerCollapse() {
  const [ledger, setLedger] = useState(false);

  return (
    <VizCard
      title="watch a run lose its information"
      hint="the bug was an average"
      caption={
        <>
          fig — ten real engagements from the synthetic 2-Tap replay. the old
          brain compresses the run before it learns; the ledger keeps each target&apos;s
          realized geometry and outcome. the red view is the retired run-level
          brain; the green view is the evidence the shipped fold actually consumes.
        </>
      }
    >
      <div className="space-y-4">
        <div className="inline-flex border border-line" role="group" aria-label="Evidence model">
          <button
            type="button"
            onClick={() => setLedger(false)}
            aria-pressed={!ledger}
            className="px-3 py-1.5 font-mono text-xs"
            style={{ color: !ledger ? C.rust : C.faint, background: !ledger ? C.rustA(0.1) : "transparent" }}
          >
            old: run summary
          </button>
          <button
            type="button"
            onClick={() => setLedger(true)}
            aria-pressed={ledger}
            className="px-3 py-1.5 font-mono text-xs"
            style={{ color: ledger ? C.hit : C.faint, background: ledger ? C.hitA(0.1) : "transparent" }}
          >
            new: engagement rows
          </button>
        </div>

        <div className="overflow-hidden border border-line bg-paper-2/40">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label={ledger ? "Ten engagements separated by amplitude and acquisition time" : "Ten engagements collapsed into one run summary"}
          >
            <g style={{ opacity: ledger ? 1 : 0.18, transition: "opacity 400ms ease" }}>
              {[0, 0.5, 1].map((fraction) => (
                <g key={fraction}>
                  <line x1={X0} x2={X1} y1={Y0 - fraction * (Y0 - Y1)} y2={Y0 - fraction * (Y0 - Y1)} stroke={C.lineA(0.45)} strokeDasharray="3 4" />
                  <line x1={X0 + fraction * (X1 - X0)} x2={X0 + fraction * (X1 - X0)} y1={Y1} y2={Y0} stroke={C.lineA(0.35)} strokeDasharray="3 4" />
                </g>
              ))}
              <text x={(X0 + X1) / 2} y={H - 10} textAnchor="middle" fill={C.faint} fontSize="11" fontFamily="var(--font-caveat), cursive">realized amplitude (degrees)</text>
              <text x="15" y={(Y0 + Y1) / 2} textAnchor="middle" fill={C.faint} fontSize="11" fontFamily="var(--font-caveat), cursive" transform={`rotate(-90 15 ${(Y0 + Y1) / 2})`}>acquisition time</text>
            </g>

            {rows.map((row, index) => {
              const cx = ledger ? xOf(row.amplitudeDeg) : xOf(meanA);
              const cy = ledger ? yOf(row.acquireMs) : yOf(meanT);
              return (
                <g key={row.index}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={ledger ? 8 + row.targetRadiusDeg * 2 : 8}
                    fill={ledger ? C.hitA(0.7) : C.rustA(0.28)}
                    stroke={ledger ? C.hit : C.rust}
                    strokeWidth="1.5"
                    style={{ transition: `cx 650ms cubic-bezier(.2,.8,.2,1) ${index * 22}ms, cy 650ms cubic-bezier(.2,.8,.2,1) ${index * 22}ms, r 450ms ease` }}
                  >
                    <title>{`target ${index + 1}: ${row.amplitudeDeg} degrees, ${row.acquireMs} ms, ${row.shots} shots`}</title>
                  </circle>
                </g>
              );
            })}

            <g style={{ opacity: ledger ? 0 : 1, transition: "opacity 300ms ease" }}>
              <circle cx={xOf(meanA)} cy={yOf(meanT)} r="38" fill={C.rustA(0.08)} stroke={C.rust} strokeWidth="1.5" strokeDasharray="4 4" />
              <text x={xOf(meanA)} y={yOf(meanT) - 2} textAnchor="middle" fill={C.rust} fontSize="18" fontFamily="var(--font-mono), monospace">10 → 1</text>
              <text x={xOf(meanA)} y={yOf(meanT) + 16} textAnchor="middle" fill={C.faint} fontSize="11" fontFamily="var(--font-caveat), cursive">one aggregate update</text>
            </g>
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-line/70 py-3 sm:grid-cols-4">
          <Stat value={ledger ? String(rows.length) : "1"} label="model updates" color={ledger ? C.hit : C.rust} />
          <Stat value={ledger ? `${minA.toFixed(1)}–${maxA.toFixed(1)}°` : `${meanA.toFixed(1)}°`} label="amplitude evidence" color={C.pur} />
          <Stat value={ledger ? `${minT}–${maxT}ms` : `${Math.round(meanT)}ms`} label="timing evidence" color={C.acc} />
          <Stat value="2" label="shots expected per target" color={C.faint} />
        </div>

        <div className="flex snap-x gap-2 overflow-x-auto pb-1">
          {rows.map((row) => (
            <div
              key={row.index}
              className="min-w-[7rem] snap-start border border-line px-2.5 py-2 transition-opacity"
              style={{ opacity: ledger ? 1 : 0.32 }}
            >
              <div className="font-mono text-xs" style={{ color: ledger ? C.hit : C.faint }}>target {row.index + 1}</div>
              <div className="mt-1 font-hand text-base leading-tight text-ink-faint">{row.amplitudeDeg}° · {row.acquireMs}ms</div>
            </div>
          ))}
        </div>
      </div>
    </VizCard>
  );
}
