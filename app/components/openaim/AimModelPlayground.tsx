"use client";

import { useEffect, useRef, useState } from "react";
import { C, Ctl, Stat, Toggle, VizCard } from "./kit";
import {
  AXIS_META,
  SCENARIO_PRESETS,
  axisDemands,
  clamp,
  demandBar,
  effectorLabel,
  handSpace,
  type AxisGroup,
  type AxisId,
  type TaskVector,
} from "./modelAxes";

const GROUPS: AxisGroup[] = ["screen + timing", "physical hand", "control loop"];

function smoothstep(value: number) {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
}

function motionAt(task: TaskVector, timeMs: number) {
  const t = Math.max(0, timeMs) / 1000;
  const amplitudePx = Math.min(128, 28 + task.A * 2.15);

  if (task.v <= 0.1 || task.dash > 0) {
    const period = task.dash > 0 ? Math.max(1.25, 1 / task.dash) : 2.15;
    const cycle = Math.floor(t / period);
    const phase = (t % period) / period;
    const slots = [
      [-1, -0.35],
      [0.9, 0.25],
      [-0.45, 0.62],
      [0.55, -0.58],
    ];
    const here = slots[cycle % slots.length]!;
    const before = slots[(cycle + slots.length - 1) % slots.length]!;
    const progress = smoothstep((phase - 0.12) / 0.3);
    const tx = here[0] * amplitudePx;
    const ty = here[1] * amplitudePx * Math.max(0.18, task.vert * 1.45);
    return {
      targetX: tx,
      targetY: ty,
      cursorX: before[0] * amplitudePx + (tx - before[0] * amplitudePx) * progress,
      cursorY:
        before[1] * amplitudePx * Math.max(0.18, task.vert * 1.45) +
        (ty - before[1] * amplitudePx * Math.max(0.18, task.vert * 1.45)) * progress,
      normalizedHand: clamp((before[0] + (here[0] - before[0]) * progress), -1, 1),
      snapped: phase < 0.12,
    };
  }

  const omega = clamp(task.v / Math.max(8, task.A), 0.45, 3.2);
  const wave = (at: number) => {
    const base = Math.sin(at * omega);
    if (task.lam < 0.7) return base;
    const snap = (2 / Math.PI) * Math.asin(Math.sin(at * omega * (0.9 + task.lam * 0.28)));
    return base * (1 - clamp(task.lam / 2.6)) + snap * clamp(task.lam / 2.6);
  };
  const lagS = 0.12 + task.lam * 0.045;
  const targetWave = wave(t);
  const cursorWave = wave(Math.max(0, t - lagS));
  const verticalWave = Math.sin(t * omega * 0.73 + 1.1);
  const cursorVertical = Math.sin(Math.max(0, t - lagS) * omega * 0.73 + 1.1);

  return {
    targetX: targetWave * amplitudePx,
    targetY: verticalWave * amplitudePx * task.vert,
    cursorX: cursorWave * amplitudePx * 0.96,
    cursorY: cursorVertical * amplitudePx * task.vert * 0.92,
    normalizedHand: cursorWave,
    snapped: false,
  };
}

function Crosshair({ x, y, onTarget }: { x: number; y: number; onTarget: boolean }) {
  const color = onTarget ? C.hit : C.acc;
  return (
    <g transform={`translate(${x} ${y})`} stroke={color} strokeWidth="2">
      <line x1="-12" x2="-4" />
      <line x1="4" x2="12" />
      <line y1="-12" y2="-4" />
      <line y1="4" y2="12" />
      <circle r="1.8" fill={color} stroke="none" />
    </g>
  );
}

export default function AimModelPlayground() {
  const first = SCENARIO_PRESETS[2]!;
  const [presetId, setPresetId] = useState(first.id);
  const [task, setTask] = useState<TaskVector>({ ...first.task, cm360: 35 });
  const [selected, setSelected] = useState<AxisId>("smoothPursuit");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timeRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
      return;
    }
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const epoch = performance.now() - timeRef.current;
    const tick = (now: number) => {
      if (now - last > 32) {
        const next = now - epoch;
        timeRef.current = next;
        setTime(next);
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const setField = <K extends keyof TaskVector>(key: K, value: TaskVector[K]) => {
    setTask((current) => ({ ...current, [key]: value }));
    setPresetId("custom");
  };
  const applyPreset = (id: string) => {
    const preset = SCENARIO_PRESETS.find((candidate) => candidate.id === id);
    if (!preset) return;
    setPresetId(id);
    setTask((current) => ({ ...preset.task, cm360: current.cm360 }));
  };

  const physical = handSpace(task);
  const demands = axisDemands(task);
  const selectedDemand = demands.find((axis) => axis.id === selected) ?? demands[0]!;
  const motion = motionAt(task, time);
  const targetX = 190 + motion.targetX;
  const targetY = 155 + motion.targetY;
  const cursorX = 190 + motion.cursorX;
  const cursorY = 155 + motion.cursorY;
  const targetRadius = Math.max(6, Math.min(21, 4 + task.W * 3.2));
  const onTarget = Math.hypot(cursorX - targetX, cursorY - targetY) <= targetRadius;

  const handOriginX = 575;
  const handY = 150;
  const unclippedMouseX = handOriginX + physical.travelCm * 28 * motion.normalizedHand;
  const mouseX = clamp(unclippedMouseX, 430, 724);
  const pathClipped = Math.abs(unclippedMouseX - mouseX) > 0.5;
  const footprintPx = Math.max(4, physical.targetCm * 28);
  const activePreset = SCENARIO_PRESETS.find((preset) => preset.id === presetId);

  return (
    <VizCard
      title="what this drill asks of you"
      hint="choose a scenario · move the knobs · inspect an axis"
      caption={
        <>
          fig — a live projection of one scenario into OpenAim&apos;s fourteen
          demand axes. the bars are raw drill demand, not your skill rating;
          the hand view is a scaled mouse-displacement proxy, not pose tracking.
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Scenario preset">
          {SCENARIO_PRESETS.map((preset) => {
            const active = preset.id === presetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                aria-pressed={active}
                className="min-h-8 rounded-full border px-3 py-1.5 font-mono text-xs transition-colors"
                style={{
                  borderColor: active ? C.acc : C.lineA(0.9),
                  color: active ? C.acc : C.faint,
                  background: active ? C.accA(0.1) : "transparent",
                }}
              >
                {preset.label}
              </button>
            );
          })}
          <span className="ml-auto">
            <Toggle on={playing} onClick={() => setPlaying((current) => !current)} accent={C.pur}>
              {playing ? "pause motion" : "play motion"}
            </Toggle>
          </span>
        </div>

        <p className="font-sans text-sm leading-relaxed text-ink-soft">
          {activePreset?.note ?? "A custom point in the same continuous scenario space."}
        </p>

        <div className="overflow-x-auto border border-line bg-paper-2/40">
          <svg
            viewBox="0 0 760 300"
            className="block w-full min-w-[680px] font-sans"
            role="img"
            aria-label={`${activePreset?.label ?? "Custom drill"}: ${physical.travelCm.toFixed(2)} centimeters of mouse travel, ${physical.targetCm.toFixed(3)} centimeter physical target width, ${selectedDemand.label} demand ${selectedDemand.value.toFixed(2)}`}
          >
            <rect x="0" y="0" width="380" height="300" fill={C.lineA(0.08)} />
            <rect x="380" y="0" width="380" height="300" fill={C.lineA(0.16)} />
            <line x1="380" x2="380" y1="0" y2="300" stroke={C.lineA(0.8)} />
            <g className="font-mono text-[11px]">
              <text x="22" y="28" fill={C.faint}>WHAT THE SCREEN ASKS</text>
              <text x="402" y="28" fill={C.faint}>WHAT THE MOUSE MUST DO · SCALED</text>
            </g>

            {[0, 1, 2, 3].slice(0, Math.max(0, task.n - 1)).map((index) => {
              const angle = (index / Math.max(1, task.n - 1)) * Math.PI * 2 + 0.5;
              return (
                <circle
                  key={index}
                  cx={190 + Math.cos(angle) * 112}
                  cy={155 + Math.sin(angle) * 75}
                  r={Math.max(5, targetRadius * 0.76)}
                  fill={C.hitA(0.12)}
                  stroke={C.hitA(0.5)}
                  strokeDasharray="3 3"
                />
              );
            })}
            <path d={`M190 155 L${targetX.toFixed(1)} ${targetY.toFixed(1)}`} stroke={C.lineA(0.7)} strokeDasharray="4 5" />
            <circle cx={targetX} cy={targetY} r={targetRadius + 5} fill={C.hitA(motion.snapped ? 0.04 : 0.1)} />
            <circle cx={targetX} cy={targetY} r={targetRadius} fill={C.hitA(0.72)} stroke={C.ink} strokeWidth="1.4" />
            <Crosshair x={cursorX} y={cursorY} onTarget={onTarget} />
            <g className="font-mono text-[10px]">
              <text x="22" y="276" fill={C.soft}>{task.A.toFixed(0)}° movement</text>
              <text x="130" y="276" fill={C.soft}>{task.W.toFixed(1)}° target</text>
              <text x="238" y="276" fill={C.soft}>{task.v.toFixed(0)}°/s</text>
              <text x="358" y="276" fill={onTarget ? C.hit : C.rust} textAnchor="end">{onTarget ? "ON TARGET" : "CORRECTING"}</text>
            </g>

            <rect x="408" y="46" width="328" height="205" rx="9" fill={C.lineA(0.1)} stroke={C.lineA(0.65)} />
            <rect x={handOriginX - 1.2 * 28} y="52" width={2.4 * 28} height="193" fill={C.purA(0.06)} />
            <line x1={handOriginX - 3.5 * 28} x2={handOriginX - 3.5 * 28} y1="52" y2="245" stroke={C.rustA(0.5)} strokeDasharray="3 4" />
            <line x1={handOriginX + 3.5 * 28} x2={handOriginX + 3.5 * 28} y1="52" y2="245" stroke={C.rustA(0.5)} strokeDasharray="3 4" />
            <line x1={handOriginX} x2={mouseX} y1={handY} y2={handY} stroke={C.acc} strokeWidth="3" strokeLinecap="round" />
            <line x1={mouseX - footprintPx / 2} x2={mouseX + footprintPx / 2} y1="87" y2="87" stroke={C.hit} strokeWidth="6" strokeLinecap="round" />
            <text x={mouseX} y="77" fill={C.hit} textAnchor="middle" className="font-mono text-[9px]">landing window</text>

            <path
              d={`M470 270 Q${(470 + mouseX - 8) / 2} 222 ${mouseX - 8} 173`}
              fill="none"
              stroke={C.accA(0.18)}
              strokeWidth="28"
              strokeLinecap="round"
            />
            <ellipse cx={mouseX - 3} cy="172" rx="23" ry="31" fill={C.accA(0.12)} stroke={C.accA(0.55)} />
            <g transform={`translate(${mouseX} ${handY})`}>
              <rect x="-12" y="-18" width="24" height="36" rx="11" fill={C.lineA(0.55)} stroke={C.acc} strokeWidth="1.7" />
              <line x1="0" x2="0" y1="-17" y2="-5" stroke={C.acc} />
              <circle cy="-10" r="2" fill={C.acc} />
            </g>
            <circle cx={handOriginX} cy={handY} r="4" fill={C.pur} />
            <text x={handOriginX} y="235" fill={C.pur} textAnchor="middle" className="font-mono text-[9px]">±1.2 cm micro zone</text>
            <text x="417" y="61" fill={C.rust} className="font-mono text-[9px]">ARM RANGE ←</text>
            <text x="727" y="61" fill={C.rust} textAnchor="end" className="font-mono text-[9px]">→ ARM RANGE</text>
            <text x="402" y="276" fill={C.soft} className="font-mono text-[10px]">{physical.travelCm.toFixed(2)} cm travel</text>
            <text x="528" y="276" fill={C.soft} className="font-mono text-[10px]">{physical.targetCm.toFixed(3)} cm window</text>
            <text x="721" y="276" fill={C.soft} textAnchor="end" className="font-mono text-[10px]">{physical.speedCmS.toFixed(1)} cm/s</text>
            {pathClipped ? <text x={mouseX} y="205" fill={C.rust} textAnchor="middle" className="font-mono text-[9px]">{unclippedMouseX < mouseX ? "← path continues" : "path continues →"}</text> : null}
          </svg>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Ctl label="sensitivity" value={task.cm360} min={10} max={100} step={1} onChange={(value) => setField("cm360", value)} fmt={(value) => `${value} cm/360`} />
          <Ctl label="movement" value={task.A} min={2} max={70} step={1} onChange={(value) => setField("A", value)} fmt={(value) => `${value}°`} accent={C.pur} />
          <Ctl label="target size" value={task.W} min={0.5} max={5} step={0.1} onChange={(value) => setField("W", value)} fmt={(value) => `${value.toFixed(1)}°`} accent={C.hit} />
          <Ctl label="target speed" value={task.v} min={0} max={60} step={2} onChange={(value) => setField("v", value)} fmt={(value) => `${value}°/s`} accent={C.rust} />
          <Ctl label="reversals" value={task.lam} min={0} max={3} step={0.1} onChange={(value) => setField("lam", value)} fmt={(value) => `${value.toFixed(1)} Hz`} accent={C.rust} />
        </div>

        <div className="grid gap-4 border-y border-line/70 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div aria-live="polite">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h5 className="font-serif text-lg text-ink">{selectedDemand.label}</h5>
              <span className="font-mono text-sm text-accent-orange">raw load {selectedDemand.value.toFixed(2)}</span>
            </div>
            <p className="mt-1 font-sans text-sm leading-relaxed text-ink-soft">{selectedDemand.meaning}</p>
            <p className="mt-2 font-mono text-xs leading-relaxed text-accent-rust">{selectedDemand.formula}</p>
            <p className="mt-1 font-sans text-xs text-ink-faint">Loaded by {selectedDemand.driver}.</p>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-1">
            <Stat value={`${physical.travelCm.toFixed(2)} cm`} label="movement" color={C.acc} />
            <Stat value={`${physical.targetCm.toFixed(3)} cm`} label="target in hand space" color={C.hit} />
            <Stat value={effectorLabel(physical.travelCm)} label="model-side proxy" color={C.pur} />
          </div>
        </div>

        <div className="space-y-5">
          {GROUPS.map((group) => (
            <section key={group} aria-labelledby={`axis-group-${group.replaceAll(" ", "-")}`}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h5 id={`axis-group-${group.replaceAll(" ", "-")}`} className="font-mono text-xs uppercase tracking-wide text-ink-faint">{group}</h5>
                <span className="font-mono text-[10px] text-ink-faint">raw model load · visual scale caps at 1.5</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {demands.filter((axis) => axis.group === group).map((axis) => {
                  const active = axis.id === selected;
                  const meta = AXIS_META.find((item) => item.id === axis.id)!;
                  const negative = axis.value < 0;
                  const barColor = group === "physical hand" ? C.pur : group === "control loop" ? C.hit : C.acc;
                  return (
                    <button
                      key={axis.id}
                      type="button"
                      onClick={() => setSelected(axis.id)}
                      aria-pressed={active}
                      className="rounded-md border p-3 text-left transition-colors"
                      style={{
                        borderColor: active ? barColor : C.lineA(0.75),
                        background: active ? (group === "physical hand" ? C.purA(0.07) : group === "control loop" ? C.hitA(0.07) : C.accA(0.07)) : "transparent",
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-sans text-sm font-medium text-ink">{axis.label}</span>
                        <span className="font-mono text-xs tabular-nums" style={{ color: negative ? C.faint : barColor }}>{axis.value.toFixed(2)}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/60">
                        <div className="h-full rounded-full" style={{ width: `${demandBar(axis.value) * 100}%`, background: negative ? C.faint : barColor }} />
                      </div>
                      <div className="mt-1.5 font-mono text-[10px] text-ink-faint">{meta.short}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </VizCard>
  );
}
