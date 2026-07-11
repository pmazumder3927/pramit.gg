"use client";

// Sensitivity as an absolute physical dimension. Drag the AutoGain anchor along
// a log cm/360 axis; clear ladder rungs to expand your mastered band toward the
// full 10–100 spectrum. "Good at every sens" becomes a measurable coverage %.

import { useState } from "react";
import { C, VizCard, Btn, Stat, useSvgDragX } from "./kit";

const W = 470;
const H = 150;
const X0 = 50;
const X1 = 440;
const YB = 78;
const LO = 10;
const HI = 100;
const L10 = Math.log(LO);
const SPAN = Math.log(HI) - L10;

const xOf = (cm: number) => X0 + ((Math.log(cm) - L10) / SPAN) * (X1 - X0);
const cmOf = (frac: number) => Math.exp(L10 + frac * SPAN);

export default function SensSpectrum() {
  const [anchor, setAnchor] = useState(45);
  const [lo, setLo] = useState(0.86); // band multipliers around the anchor
  const [hi, setHi] = useState(1.16);

  const bandLo = Math.max(LO, anchor * lo);
  const bandHi = Math.min(HI, anchor * hi);
  const coverage = Math.round(((Math.log(bandHi) - Math.log(bandLo)) / SPAN) * 100);

  const drag = useSvgDragX(X0, X1, (f) => setAnchor(Math.round(cmOf(f))));

  const clearRung = () => {
    setLo((l) => Math.max(0.4, l * 0.94));
    setHi((h) => Math.min(2.4, h * 1.06));
  };
  const missEdge = () => {
    setLo((l) => Math.min(0.95, l * 1.02));
    setHi((h) => Math.max(1.05, h * 0.98));
  };
  const reset = () => { setLo(0.86); setHi(1.16); };

  const ticks = [10, 15, 20, 30, 45, 70, 100];

  return (
    <VizCard
      title="good at every sensitivity"
      hint="drag the anchor · clear rungs"
      caption={
        <>
          fig — the mastered-band meter. sensitivity is measured in absolute
          cm/360 because signal-dependent noise lives in motor coordinates, so
          skill at 20 and at 60 cm/360 are separate capabilities. hold the band's
          edges and it expands outward — a slogan turned into a coverage number.
        </>
      }
    >
      <div className="space-y-4">
        <svg
          ref={drag.ref}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none cursor-ew-resize font-sans"
          fontWeight={500}
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          role="img"
          aria-label={`Mastered sensitivity band from ${Math.round(bandLo)} to ${Math.round(bandHi)} cm per 360, covering ${coverage} percent of the spectrum`}
        >
          {/* full spectrum */}
          <rect x={X0} y={YB - 8} width={X1 - X0} height={16} rx={8} fill={C.lineA(0.4)} />
          {/* mastered band */}
          <rect x={xOf(bandLo)} y={YB - 12} width={xOf(bandHi) - xOf(bandLo)} height={24} rx={12} fill={C.accA(0.18)} stroke={C.acc} />
          {/* expand arrows */}
          <text x={xOf(bandLo) - 6} y={YB + 4} fontSize={12} fill={C.hit} textAnchor="end">◄</text>
          <text x={xOf(bandHi) + 6} y={YB + 4} fontSize={12} fill={C.hit} textAnchor="start">►</text>
          {/* anchor */}
          <circle cx={xOf(anchor)} cy={YB} r={7} fill={C.acc} stroke="rgb(var(--surface))" strokeWidth={2} />
          <text x={xOf(anchor)} y={YB - 20} fontSize={11} fill={C.acc} textAnchor="middle">anchor</text>
          {/* ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={xOf(t)} y1={YB + 14} x2={xOf(t)} y2={YB + 19} stroke={C.faint} />
              <text x={xOf(t)} y={YB + 32} fontSize={11} fill={C.faint} textAnchor="middle">{t}</text>
            </g>
          ))}
          <text x={X1} y={YB + 32} fontSize={11} fill={C.faint} textAnchor="end">cm/360</text>
        </svg>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap gap-2">
            <Btn onClick={clearRung}>cleared a rung ↑</Btn>
            <button type="button" onClick={missEdge} className="min-h-8 rounded-full border border-line/90 px-3.5 py-1.5 font-sans text-sm font-medium leading-none text-ink-faint transition-colors hover:border-accent-rust hover:text-accent-rust">missed the edge ↓</button>
            <button type="button" onClick={reset} className="font-sans text-sm font-medium text-ink-faint underline decoration-dotted underline-offset-4 hover:text-accent-rust">reset</button>
          </div>
          <div className="ml-auto flex gap-6">
            <Stat value={`${Math.round(bandLo)}–${Math.round(bandHi)}`} label="mastered cm/360" color={C.acc} />
            <Stat value={`${coverage}%`} label="of spectrum" color={coverage >= 60 ? C.hit : C.pur} />
          </div>
        </div>
      </div>
    </VizCard>
  );
}
