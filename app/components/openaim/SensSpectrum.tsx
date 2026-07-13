"use client";

import { useState } from "react";
import { C, VizCard } from "./kit";
import {
  SCENARIO_PRESETS,
  axisDemands,
  clamp,
  handSpace,
  type AxisId,
  type TaskVector,
} from "./modelAxes";

const SENS_LO = 10;
const SENS_HI = 100;

const PRESET_IDS = ["micro", "wide", "smooth"] as const;
const PRESETS = PRESET_IDS.map((id) => {
  const preset = SCENARIO_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Missing OpenAim scenario preset: ${id}`);
  return preset;
});

const HAND_DEMANDS: Array<{ id: AxisId; label: string; color: string }> = [
  { id: "microControl", label: "micro control", color: C.pur },
  { id: "handPrecision", label: "landing precision", color: C.hit },
  { id: "armControl", label: "arm range", color: C.rust },
  { id: "handSpeed", label: "hand speed", color: C.acc },
];

function Crosshair({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={C.pur} strokeWidth="2">
      <circle r="6" fill="none" />
      <line x1="-11" x2="-4" />
      <line x1="4" x2="11" />
      <line y1="-11" y2="-4" />
      <line y1="4" y2="11" />
    </g>
  );
}

function MouseGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x="-13"
        y="-20"
        width="26"
        height="40"
        rx="12"
        fill={C.lineA(0.25)}
        stroke={C.acc}
        strokeWidth="2"
      />
      <line x1="0" x2="0" y1="-19" y2="-6" stroke={C.acc} />
      <circle cy="-11" r="2" fill={C.acc} />
    </g>
  );
}

function takeaway(
  dominant: { id: AxisId; value: number },
  space: ReturnType<typeof handSpace>,
) {
  if (dominant.value < 0.15) {
    return `This setting keeps all four physical demands modest for the selected task.`;
  }

  switch (dominant.id) {
    case "handPrecision":
      return `The ${space.targetCm.toFixed(3)} cm landing window is the main hand-space constraint. Faster sensitivity would make it smaller.`;
    case "armControl":
      return `The ${space.travelCm.toFixed(2)} cm sweep is the main constraint. Slower sensitivity asks the arm to cover even more desk.`;
    case "handSpeed":
      return `Keeping up asks for ${space.speedCmS.toFixed(1)} cm/s of mouse speed. Slower sensitivity raises that requirement.`;
    case "microControl":
      return `The whole correction fits into ${space.travelCm.toFixed(2)} cm, putting the movement in the model's micro-control range.`;
    default:
      return `This sensitivity changes the physical version of the task without changing its on-screen geometry.`;
  }
}

export default function SensSpectrum() {
  const [presetIndex, setPresetIndex] = useState(0);
  const [cm360, setCm360] = useState(35);
  const preset = PRESETS[presetIndex];
  const task: TaskVector = { ...preset.task, cm360 };
  const space = handSpace(task);
  const physical = axisDemands(task).filter((axis) => axis.group === "physical hand");
  const byId = new Map(physical.map((axis) => [axis.id, axis]));
  const dominant = physical.reduce((highest, axis) =>
    axis.value > highest.value ? axis : highest,
  );

  const screenTargetX = 50 + clamp(task.A / 45, 0.12, 1) * 235;
  const screenTargetR = clamp(task.W * 4.5, 5, 18);
  const handStartX = 42;
  const handEndX = handStartX + (clamp(space.travelCm, 0, 12) / 12) * 250;
  const landingWindowPx = clamp(space.targetCm * (250 / 12), 5, 30);
  const sliderPercent = ((cm360 - SENS_LO) / (SENS_HI - SENS_LO)) * 100;

  return (
    <VizCard
      title="the same aim can ask a different hand question"
      hint="pick a task · drag sensitivity"
      caption={
        <>
          fig — the angular task stays fixed while cm/360 changes its physical
          travel, landing window, and speed. the coach reasons over those
          hand-space demands; it does not advance through a sensitivity ladder.
        </>
      }
    >
      <div className="space-y-6">
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label="Choose an aiming scenario"
        >
          {PRESETS.map((candidate, index) => {
            const active = index === presetIndex;
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setPresetIndex(index)}
                aria-pressed={active}
                className="min-h-10 rounded-lg border px-2 py-2 font-sans text-xs font-medium transition-colors sm:text-sm"
                style={{
                  borderColor: active ? C.pur : C.lineA(0.85),
                  background: active ? C.purA(0.12) : "transparent",
                  color: active ? C.pur : C.soft,
                }}
              >
                {candidate.label}
              </button>
            );
          })}
        </div>

        <div>
          <div className="mb-2 flex items-end justify-between gap-4">
            <div>
              <div className="font-sans text-sm font-semibold text-ink">
                sensitivity
              </div>
              <div className="font-sans text-xs text-ink-faint">
                lower is faster · higher is slower
              </div>
            </div>
            <output
              htmlFor="sens-spectrum-control"
              className="font-mono text-2xl font-medium tabular-nums text-accent-orange sm:text-3xl"
              aria-live="polite"
            >
              {cm360} <span className="text-sm">cm/360</span>
            </output>
          </div>
          <input
            id="sens-spectrum-control"
            type="range"
            min={SENS_LO}
            max={SENS_HI}
            step={1}
            value={cm360}
            onChange={(event) => setCm360(Number(event.target.value))}
            aria-label="Sensitivity in centimeters per 360 degree turn"
            className="h-3 w-full cursor-pointer appearance-none rounded-full"
            style={{
              accentColor: C.acc,
              background: `linear-gradient(90deg, ${C.acc} ${sliderPercent}%, ${C.line} ${sliderPercent}%)`,
            }}
          />
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-faint">
            <span>10 · faster</span>
            <span>100 · slower</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <section className="rounded-lg border border-line/70 bg-line/10 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <h5 className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-faint">
                screen space
              </h5>
              <span className="font-mono text-xs text-accent-purple">unchanged</span>
            </div>
            <svg
              viewBox="0 0 340 150"
              className="mt-2 block w-full"
              role="img"
              aria-label={`${task.A} degree movement to a ${task.W} degree wide target`}
            >
              <line
                x1="50"
                y1="76"
                x2={screenTargetX}
                y2="76"
                stroke={C.purA(0.55)}
                strokeWidth="2"
                strokeDasharray="5 5"
              />
              <Crosshair x={50} y={76} />
              <circle cx={screenTargetX} cy="76" r={screenTargetR + 6} fill={C.hitA(0.09)} />
              <circle
                cx={screenTargetX}
                cy="76"
                r={screenTargetR}
                fill={C.hitA(0.75)}
                stroke={C.ink}
                strokeWidth="1.5"
              />
            </svg>
            <div className="grid grid-cols-3 border-t border-line/60 px-2 py-2 text-center">
              <div><div className="font-mono text-sm text-accent-purple">{task.A}°</div><div className="text-[10px] text-ink-faint">movement</div></div>
              <div><div className="font-mono text-sm text-ink">{task.W}°</div><div className="text-[10px] text-ink-faint">target</div></div>
              <div><div className="font-mono text-sm text-ink">{task.v}°/s</div><div className="text-[10px] text-ink-faint">speed</div></div>
            </div>
          </section>

          <section className="rounded-lg border border-line/70 bg-line/10 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <h5 className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-faint">
                hand space
              </h5>
              <span className="font-mono text-xs text-accent-orange">changes</span>
            </div>
            <svg
              viewBox="0 0 340 150"
              className="mt-2 block w-full"
              role="img"
              aria-label={`${space.travelCm.toFixed(2)} centimeters of mouse travel with a ${space.targetCm.toFixed(3)} centimeter landing window`}
            >
              <line x1={handStartX} y1="76" x2="302" y2="76" stroke={C.lineA(0.8)} strokeWidth="2" />
              <line
                x1={handStartX}
                y1="76"
                x2={handEndX}
                y2="76"
                stroke={C.acc}
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx={handStartX} cy="76" r="4" fill={C.acc} />
              <line
                x1={handEndX - landingWindowPx / 2}
                x2={handEndX + landingWindowPx / 2}
                y1="38"
                y2="38"
                stroke={C.hit}
                strokeWidth="6"
                strokeLinecap="round"
              />
              <MouseGlyph x={handEndX} y={76} />
            </svg>
            <div className="grid grid-cols-3 border-t border-line/60 px-2 py-2 text-center">
              <div><div className="font-mono text-sm text-accent-orange">{space.travelCm.toFixed(2)} cm</div><div className="text-[10px] text-ink-faint">travel</div></div>
              <div><div className="font-mono text-sm" style={{ color: C.hit }}>{space.targetCm.toFixed(3)} cm</div><div className="text-[10px] text-ink-faint">landing window</div></div>
              <div><div className="font-mono text-sm text-ink">{space.speedCmS.toFixed(1)} cm/s</div><div className="text-[10px] text-ink-faint">hand speed</div></div>
            </div>
          </section>
        </div>

        <section aria-labelledby="hand-demand-heading">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h5 id="hand-demand-heading" className="font-sans text-sm font-semibold text-ink">
              What the hand is being asked to do
            </h5>
            <span className="font-mono text-[10px] text-ink-faint">raw demand · 0–2+</span>
          </div>
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {HAND_DEMANDS.map((item) => {
              const value = byId.get(item.id)?.value ?? 0;
              const width = (clamp(value, 0, 2) / 2) * 100;
              return (
                <div
                  key={item.id}
                  role="meter"
                  aria-label={`${item.label} demand`}
                  aria-valuemin={0}
                  aria-valuemax={2}
                  aria-valuenow={Math.min(2, value)}
                  aria-valuetext={value.toFixed(2)}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="font-sans text-xs font-medium text-ink-soft">{item.label}</span>
                    <span className="font-mono text-xs tabular-nums" style={{ color: item.color }}>
                      {value.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line/70">
                    <div
                      className="h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
                      style={{ width: `${width}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div
          className="rounded-lg border px-4 py-3"
          style={{ borderColor: C.accA(0.45), background: C.accA(0.08) }}
          aria-live="polite"
        >
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-accent-orange">
            takeaway
          </div>
          <p className="mt-1 font-sans text-sm leading-relaxed text-ink-soft">
            {takeaway(dominant, space)}
          </p>
        </div>
      </div>
    </VizCard>
  );
}
