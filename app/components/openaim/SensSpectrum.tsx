"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { C, Ctl, Stat, VizCard, useSvgDragX } from "./kit";
import { axisDemands, clamp, effectorLabel, handSpace, type AxisId, type TaskVector } from "./modelAxes";

const W = 720;
const H = 420;
const SENS_LO = 10;
const SENS_HI = 100;
const LOG_LO = Math.log(SENS_LO);
const LOG_SPAN = Math.log(SENS_HI) - LOG_LO;
const TRACK_X0 = 66;
const TRACK_X1 = 674;
const ANCHOR = 35;

const HAND_CURVES: Array<{ id: AxisId; label: string; color: string }> = [
  { id: "microControl", label: "micro control", color: C.pur },
  { id: "handPrecision", label: "fine-hand precision", color: C.acc },
  { id: "armControl", label: "arm-range control", color: C.rust },
  { id: "handSpeed", label: "hand speed", color: C.hit },
];

const sensX = (cm360: number) =>
  TRACK_X0 + ((Math.log(cm360) - LOG_LO) / LOG_SPAN) * (TRACK_X1 - TRACK_X0);
const sensAt = (fraction: number) => Math.exp(LOG_LO + fraction * LOG_SPAN);

function MouseGlyph({ x, y, color, ghost = false }: { x: number; y: number; color: string; ghost?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={ghost ? 0.55 : 1}>
      <rect x="-11" y="-16" width="22" height="32" rx="10" fill={ghost ? "none" : C.lineA(0.35)} stroke={color} strokeWidth="1.7" />
      <line x1="0" x2="0" y1="-15" y2="-4" stroke={color} strokeWidth="1.2" />
      <circle cx="0" cy="-8" r="1.8" fill={color} />
    </g>
  );
}

export default function SensSpectrum() {
  const [cm360, setCm360] = useState(35);
  const [angle, setAngle] = useState(18);
  const [width, setWidth] = useState(1.4);
  const [speed, setSpeed] = useState(30);
  const [focusHand, setFocusHand] = useState<AxisId>("handPrecision");

  const task: TaskVector = {
    A: angle,
    W: width,
    v: speed,
    lam: 0,
    smooth: 0.7,
    holdS: 0,
    n: 1,
    vert: 0,
    cm360,
    pace: 1,
    hp: 1,
    dash: 0,
    jump: 0,
    depthVar: 0,
    tall: 0,
  };
  const current = handSpace(task);
  const anchor = handSpace({ ...task, cm360: ANCHOR });
  const demands = axisDemands(task);
  const physical = demands
    .filter((axis) => axis.group === "physical hand")
    .sort((a, b) => b.value - a.value);
  const focusedDemand = physical.find((axis) => axis.id === focusHand) ?? physical[0]!;
  const currentLoads = new Map(physical.map((axis) => [axis.id, axis.value]));
  const curveSamples = Array.from({ length: 41 }, (_, index) => {
    const sampleCm360 = sensAt(index / 40);
    const sampleLoads = axisDemands({ ...task, cm360: sampleCm360 });
    return {
      cm360: sampleCm360,
      loads: new Map(sampleLoads.map((axis) => [axis.id, axis.value])),
    };
  });
  const demandY = (value: number) => 365 - (clamp(value, 0, 2) / 2) * 84;
  const curvePath = (id: AxisId) =>
    curveSamples
      .map((sample, index) => `${index === 0 ? "M" : "L"}${sensX(sample.cm360).toFixed(1)} ${demandY(sample.loads.get(id) ?? 0).toFixed(1)}`)
      .join(" ");
  const screenDistance = Math.min(190, 42 + angle * 2.25);
  const targetRadius = Math.max(5, Math.min(22, 4 + width * 3.4));
  const motorScale = 12;
  const currentEnd = Math.min(680, 446 + current.travelCm * motorScale);
  const anchorEnd = Math.min(680, 446 + anchor.travelCm * motorScale);
  const drag = useSvgDragX(TRACK_X0, TRACK_X1, (fraction) =>
    setCm360(Math.round(sensAt(fraction))),
  );
  const beginSpectrumDrag = (event: ReactPointerEvent<SVGRectElement>) =>
    drag.onPointerDown(event as unknown as ReactPointerEvent<SVGSVGElement>);
  const moveSpectrumDrag = (event: ReactPointerEvent<SVGRectElement>) =>
    drag.onPointerMove(event as unknown as ReactPointerEvent<SVGSVGElement>);

  return (
    <VizCard
      title="sensitivity is part of the drill"
      hint="drag cm/360 · watch hand-space demand"
      caption={
        <>
          fig — screen geometry stays in degrees; the motor-space drawing is a
          scaled proxy for physical mouse displacement, not measured anatomy.
          the curves isolate the four hand-space demands; the complete coach
          also prices learning value, information, difficulty, and variety.
        </>
      }
    >
      <div className="space-y-5">
        <div className="overflow-x-auto">
          <svg
            ref={drag.ref}
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full min-w-[640px] font-sans"
            role="img"
            aria-label={`${angle} degree shot at ${cm360} centimeters per 360 needs ${current.travelCm.toFixed(2)} centimeters of mouse travel and gives a ${current.targetCm.toFixed(2)} centimeter landing window`}
          >
          <rect x="20" y="20" width="300" height="205" rx="8" fill={C.lineA(0.12)} stroke={C.lineA(0.75)} />
          <rect x="340" y="20" width="360" height="205" rx="8" fill={C.lineA(0.12)} stroke={C.lineA(0.75)} />

          <g className="font-mono text-[11px]">
            <text x="38" y="45" fill={C.faint}>SCREEN SPACE · UNCHANGED</text>
            <text x="358" y="45" fill={C.faint}>MOTOR SPACE · SCALED SCHEMATIC</text>
          </g>

          <g>
            <line x1="78" y1="136" x2={78 + screenDistance} y2="136" stroke={C.accA(0.5)} strokeWidth="2" strokeDasharray="5 5" />
            <path d="M78 126v20M68 136h20" stroke={C.pur} strokeWidth="2" />
            <circle cx={78 + screenDistance} cy="136" r={targetRadius + 5} fill={C.hitA(0.08)} />
            <circle cx={78 + screenDistance} cy="136" r={targetRadius} fill={C.hitA(0.72)} stroke={C.ink} strokeWidth="1.5" />
            <text x={78 + screenDistance / 2} y="111" fill={C.acc} textAnchor="middle" className="font-mono text-[12px]">{angle}°</text>
            <text x="170" y="196" fill={C.soft} textAnchor="middle" className="font-sans text-[12px]">target diameter {width.toFixed(1)}° · speed {speed}°/s</text>
          </g>

          <g>
            <line x1="446" x2="680" y1="108" y2="108" stroke={C.lineA(0.5)} strokeDasharray="3 4" />
            <line x1="446" x2="680" y1="174" y2="174" stroke={C.lineA(0.5)} strokeDasharray="3 4" />
            <text x="358" y="112" fill={C.acc} className="font-mono text-[11px]">CANDIDATE · {cm360}</text>
            <text x="358" y="178" fill={C.pur} className="font-mono text-[11px]">EXAMPLE ANCHOR · {ANCHOR}</text>
            <line x1="446" x2={currentEnd} y1="108" y2="108" stroke={C.acc} strokeWidth="3" />
            <line x1="446" x2={anchorEnd} y1="174" y2="174" stroke={C.pur} strokeWidth="2" strokeDasharray="5 4" />
            <circle cx="446" cy="108" r="4" fill={C.acc} />
            <circle cx="446" cy="174" r="4" fill={C.pur} />
            <MouseGlyph x={currentEnd} y={108} color={C.acc} />
            <MouseGlyph x={anchorEnd} y={174} color={C.pur} ghost />
            <text x={(446 + currentEnd) / 2} y="92" fill={C.acc} textAnchor="middle" className="font-mono text-[11px]">{current.travelCm.toFixed(2)} cm</text>
            <text x={(446 + anchorEnd) / 2} y="158" fill={C.pur} textAnchor="middle" className="font-mono text-[11px]">{anchor.travelCm.toFixed(2)} cm</text>
            <line x1={currentEnd - Math.max(3, current.targetCm * motorScale / 2)} x2={currentEnd + Math.max(3, current.targetCm * motorScale / 2)} y1="135" y2="135" stroke={C.hit} strokeWidth="5" strokeLinecap="round" />
            <text x={currentEnd} y="151" fill={C.hit} textAnchor="middle" className="font-mono text-[10px]">{current.targetCm.toFixed(3)} cm landing window</text>
          </g>

          <g className="cursor-ew-resize">
            <text x={TRACK_X0} y="252" fill={C.faint} className="font-mono text-[11px]">HAND-SPACE DEMAND FOR THIS EXACT GEOMETRY</text>
            {HAND_CURVES.map((curve, index) => (
              <g key={curve.id} transform={`translate(${TRACK_X0 + index * 151} 269)`}>
                <line x1="0" x2="18" stroke={curve.color} strokeWidth="2.5" />
                <text x="24" y="4" fill={curve.color} className="font-mono text-[9px]">{curve.label}</text>
              </g>
            ))}
            {[0, 1, 2].map((tick) => (
              <g key={tick}>
                <line x1={TRACK_X0} x2={TRACK_X1} y1={demandY(tick)} y2={demandY(tick)} stroke={C.lineA(tick === 0 ? 0.8 : 0.4)} strokeDasharray={tick === 0 ? undefined : "3 4"} />
                <text x={TRACK_X0 - 9} y={demandY(tick) + 4} fill={C.faint} textAnchor="end" className="font-mono text-[9px]">{tick}</text>
              </g>
            ))}
            {HAND_CURVES.map((curve) => (
              <path
                key={curve.id}
                d={curvePath(curve.id)}
                fill="none"
                stroke={curve.color}
                strokeWidth={curve.id === focusHand ? 3.2 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={curve.id === focusHand ? 1 : 0.38}
              />
            ))}
            <line x1={sensX(ANCHOR)} x2={sensX(ANCHOR)} y1="278" y2="373" stroke={C.purA(0.7)} strokeWidth="1.3" strokeDasharray="3 3" />
            <text x={sensX(ANCHOR)} y="289" fill={C.pur} textAnchor="middle" className="font-mono text-[9px]">example anchor</text>
            <line x1={sensX(cm360)} x2={sensX(cm360)} y1="278" y2="373" stroke={C.ink} strokeWidth="1.2" />
            {HAND_CURVES.map((curve) => (
              <circle key={curve.id} cx={sensX(cm360)} cy={demandY(currentLoads.get(curve.id) ?? 0)} r="4" fill={curve.color} stroke="rgb(var(--surface))" strokeWidth="1.5" />
            ))}
            <text x={TRACK_X0} y="397" fill={C.faint} className="font-mono text-[10px]">10 · HIGH SENS / SHORT TRAVEL</text>
            <text x={TRACK_X1} y="397" fill={C.faint} textAnchor="end" className="font-mono text-[10px]">LOW SENS / LONG TRAVEL · 100</text>
            <text x={sensX(cm360)} y="410" fill={C.ink} textAnchor="middle" className="font-mono text-[11px]">candidate {cm360} cm/360</text>
            <rect
              x="40"
              y="238"
              width="640"
              height="180"
              fill="transparent"
              className="touch-none cursor-ew-resize"
              onPointerDown={beginSpectrumDrag}
              onPointerMove={moveSpectrumDrag}
            />
          </g>
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Hand-space demand to emphasize">
          <span className="mr-1 font-mono text-xs text-ink-faint">inspect one ingredient</span>
          {HAND_CURVES.map((curve) => {
            const active = curve.id === focusHand;
            return (
              <button
                key={curve.id}
                type="button"
                onClick={() => setFocusHand(curve.id)}
                aria-pressed={active}
                className="min-h-8 rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition-colors"
                style={{
                  borderColor: active ? curve.color : C.lineA(0.85),
                  color: active ? curve.color : C.faint,
                  background: active ? C.lineA(0.18) : "transparent",
                }}
              >
                {curve.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Ctl label="sensitivity" value={cm360} min={SENS_LO} max={SENS_HI} step={1} onChange={setCm360} fmt={(value) => `${value} cm/360`} />
          <Ctl label="movement angle" value={angle} min={3} max={50} step={1} onChange={setAngle} fmt={(value) => `${value}°`} accent={C.pur} />
          <Ctl label="target diameter" value={width} min={0.5} max={4} step={0.1} onChange={setWidth} fmt={(value) => `${value.toFixed(1)}°`} accent={C.hit} />
          <Ctl label="target speed" value={speed} min={0} max={60} step={2} onChange={setSpeed} fmt={(value) => `${value}°/s`} accent={C.rust} />
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-line/70 pt-4 sm:grid-cols-4">
          <Stat value={`${current.travelCm.toFixed(2)} cm`} label={`mouse travel · ${effectorLabel(current.travelCm)}`} color={C.acc} />
          <Stat value={`${current.targetCm.toFixed(3)} cm`} label="physical landing window" color={C.hit} />
          <Stat value={`${current.speedCmS.toFixed(1)} cm/s`} label="required hand speed" color={C.pur} />
          <Stat value={focusedDemand.value.toFixed(2)} label={`${focusedDemand.label} raw demand`} color={HAND_CURVES.find((curve) => curve.id === focusHand)?.color ?? C.rust} />
        </div>
      </div>
    </VizCard>
  );
}
