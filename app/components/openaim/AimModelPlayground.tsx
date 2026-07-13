"use client";

import { useEffect, useRef, useState } from "react";
import { C, Ctl, Toggle, VizCard } from "./kit";
import {
  SCENARIO_PRESETS,
  axisDemands,
  clamp,
  demandBar,
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
  const setSensitivity = (value: number) => {
    setTask((current) => ({ ...current, cm360: value }));
  };
  const applyPreset = (id: string) => {
    const preset = SCENARIO_PRESETS.find((candidate) => candidate.id === id);
    if (!preset) return;
    setPresetId(id);
    setTask((current) => ({ ...preset.task, cm360: current.cm360 }));
  };

  const physical = handSpace(task);
  const demands = axisDemands(task);
  const motion = motionAt(task, time);
  const targetX = 190 + motion.targetX;
  const targetY = 120 + motion.targetY;
  const cursorX = 190 + motion.cursorX;
  const cursorY = 120 + motion.cursorY;
  const targetRadius = Math.max(6, Math.min(21, 4 + task.W * 3.2));
  const onTarget = Math.hypot(cursorX - targetX, cursorY - targetY) <= targetRadius;

  const handOriginX = 190;
  const handY = 118;
  const handScale = 24;
  const unclippedMouseX = handOriginX + physical.travelCm * handScale * motion.normalizedHand;
  const mouseX = clamp(unclippedMouseX, 28, 352);
  const pathClipped = Math.abs(unclippedMouseX - mouseX) > 0.5;
  const footprintPx = Math.max(4, physical.targetCm * handScale);
  const activePreset = SCENARIO_PRESETS.find((preset) => preset.id === presetId);

  return (
    <VizCard
      title="a drill's fourteen demands"
      hint="choose a scenario"
      caption={
        <>
          fig — the same aim task in screen space, hand space, and the model&apos;s
          fourteen raw demand axes. the hand is a displacement proxy, not pose tracking.
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 sm:max-w-xs">
            <span className="mb-1 block text-xs font-medium text-ink-faint">Scenario</span>
            <select
              value={presetId}
              onChange={(event) => applyPreset(event.target.value)}
              className="min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink"
              aria-label="Scenario preset"
            >
              {presetId === "custom" ? <option value="custom">Custom scenario</option> : null}
              {SCENARIO_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>
          <Toggle on={playing} onClick={() => setPlaying((current) => !current)} accent={C.pur}>
            {playing ? "pause" : "play"}
          </Toggle>
        </div>

        <p className="text-sm leading-relaxed text-ink-soft">
          {activePreset?.note ?? "A custom point in the same continuous scenario space."}
        </p>

        <div className="rounded-md border border-accent-orange/30 bg-accent-orange/5 p-3 sm:p-4">
          <Ctl
            label="Sensitivity"
            value={task.cm360}
            min={10}
            max={100}
            step={1}
            onChange={setSensitivity}
            fmt={(value) => `${value} cm/360`}
          />
          <p className="mt-2 text-xs text-ink-faint">
            Changes the hand-space demand, not the on-screen task.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <section className="min-w-0 overflow-hidden rounded-md border border-line bg-paper-2/40" aria-labelledby="screen-space-title">
            <div className="flex items-baseline justify-between gap-2 border-b border-line/70 px-3 py-2">
              <h5 id="screen-space-title" className="text-sm font-medium text-ink">Screen space</h5>
              <span className="font-mono text-[11px] text-ink-faint">{task.A.toFixed(0)}° move · {task.W.toFixed(1)}° target</span>
            </div>
            <svg
              viewBox="0 0 380 240"
              className="block h-auto w-full"
              role="img"
              aria-label={`${activePreset?.label ?? "Custom drill"} on screen: ${task.A.toFixed(0)} degree movement and ${task.W.toFixed(1)} degree target`}
            >
              {[0, 1, 2, 3].slice(0, Math.max(0, task.n - 1)).map((index) => {
                const angle = (index / Math.max(1, task.n - 1)) * Math.PI * 2 + 0.5;
                return (
                  <circle
                    key={index}
                    cx={190 + Math.cos(angle) * 112}
                    cy={120 + Math.sin(angle) * 72}
                    r={Math.max(5, targetRadius * 0.76)}
                    fill={C.hitA(0.08)}
                    stroke={C.hitA(0.42)}
                    strokeDasharray="3 4"
                  />
                );
              })}
              <path d={`M190 120 L${targetX.toFixed(1)} ${targetY.toFixed(1)}`} stroke={C.lineA(0.75)} strokeDasharray="4 5" />
              <circle cx={targetX} cy={targetY} r={targetRadius + 5} fill={C.hitA(motion.snapped ? 0.03 : 0.08)} />
              <circle cx={targetX} cy={targetY} r={targetRadius} fill={C.hitA(0.7)} stroke={C.ink} strokeWidth="1.3" />
              <Crosshair x={cursorX} y={cursorY} onTarget={onTarget} />
            </svg>
          </section>

          <section className="min-w-0 overflow-hidden rounded-md border border-line bg-paper-2/40" aria-labelledby="hand-space-title">
            <div className="flex items-baseline justify-between gap-2 border-b border-line/70 px-3 py-2">
              <h5 id="hand-space-title" className="text-sm font-medium text-ink">Hand space</h5>
              <span className="font-mono text-[11px] text-ink-faint">{physical.travelCm.toFixed(2)} cm move · {physical.targetCm.toFixed(3)} cm window</span>
            </div>
            <svg
              viewBox="0 0 380 240"
              className="block h-auto w-full"
              role="img"
              aria-label={`${physical.travelCm.toFixed(2)} centimeters of mouse travel, ${physical.targetCm.toFixed(3)} centimeter landing window, at ${physical.speedCmS.toFixed(1)} centimeters per second`}
            >
              <rect x={handOriginX - 1.2 * handScale} y="20" width={2.4 * handScale} height="190" fill={C.purA(0.06)} />
              <line x1={handOriginX - 3.5 * handScale} x2={handOriginX - 3.5 * handScale} y1="20" y2="210" stroke={C.rustA(0.42)} strokeDasharray="3 5" />
              <line x1={handOriginX + 3.5 * handScale} x2={handOriginX + 3.5 * handScale} y1="20" y2="210" stroke={C.rustA(0.42)} strokeDasharray="3 5" />
              <line x1={handOriginX} x2={mouseX} y1={handY} y2={handY} stroke={C.acc} strokeWidth="3" strokeLinecap="round" />
              <line x1={mouseX - footprintPx / 2} x2={mouseX + footprintPx / 2} y1="55" y2="55" stroke={C.hit} strokeWidth="6" strokeLinecap="round" />
              <path
                d={`M95 224 Q${(95 + mouseX - 7) / 2} 185 ${mouseX - 7} 142`}
                fill="none"
                stroke={C.accA(0.16)}
                strokeWidth="27"
                strokeLinecap="round"
              />
              <ellipse cx={mouseX - 3} cy="144" rx="22" ry="29" fill={C.accA(0.1)} stroke={C.accA(0.48)} />
              <g transform={`translate(${mouseX} ${handY})`}>
                <rect x="-12" y="-18" width="24" height="36" rx="11" fill={C.lineA(0.55)} stroke={C.acc} strokeWidth="1.7" />
                <line x1="0" x2="0" y1="-17" y2="-5" stroke={C.acc} />
                <circle cy="-10" r="2" fill={C.acc} />
              </g>
              <circle cx={handOriginX} cy={handY} r="4" fill={C.pur} />
              {pathClipped ? (
                <text x={mouseX} y="198" fill={C.rust} textAnchor="middle" className="font-mono text-[10px]">
                  {unclippedMouseX < mouseX ? "← continues" : "continues →"}
                </text>
              ) : null}
            </svg>
          </section>
        </div>

        <details className="rounded-md border border-line/80 px-3 py-2">
          <summary className="cursor-pointer select-none text-sm font-medium text-ink-soft">Adjust scenario geometry</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Ctl label="movement" value={task.A} min={2} max={70} step={1} onChange={(value) => setField("A", value)} fmt={(value) => `${value}°`} accent={C.pur} />
            <Ctl label="target size" value={task.W} min={0.5} max={5} step={0.1} onChange={(value) => setField("W", value)} fmt={(value) => `${value.toFixed(1)}°`} accent={C.hit} />
            <Ctl label="target speed" value={task.v} min={0} max={60} step={2} onChange={(value) => setField("v", value)} fmt={(value) => `${value}°/s`} accent={C.rust} />
            <Ctl label="reversals" value={task.lam} min={0} max={3} step={0.1} onChange={(value) => setField("lam", value)} fmt={(value) => `${value.toFixed(1)} Hz`} accent={C.rust} />
          </div>
        </details>

        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h5 className="font-serif text-lg text-ink">Fourteen kinds of demand</h5>
            <span className="font-mono text-[10px] text-ink-faint">raw load · bars cap at 1.5</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {GROUPS.map((group, groupIndex) => {
              const barColor = group === "physical hand" ? C.pur : group === "control loop" ? C.hit : C.acc;
              return (
                <section
                  key={group}
                  className={groupIndex === GROUPS.length - 1 ? "sm:col-span-2" : undefined}
                  aria-labelledby={`axis-group-${group.replaceAll(" ", "-")}`}
                >
                  <h6 id={`axis-group-${group.replaceAll(" ", "-")}`} className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-faint">{group}</h6>
                  <div className="overflow-hidden rounded-md border border-line/80">
                    {demands.filter((axis) => axis.group === group).map((axis, index) => {
                      const active = axis.id === selected;
                      const negative = axis.value < 0;
                      return (
                        <div key={axis.id} className={index ? "border-t border-line/60" : undefined}>
                          <button
                            type="button"
                            onClick={() => setSelected(axis.id)}
                            aria-pressed={active}
                            className="grid min-h-10 w-full grid-cols-[minmax(0,1fr)_4.5rem_2.5rem] items-center gap-2 px-3 py-2 text-left transition-colors"
                            style={{ background: active ? (group === "physical hand" ? C.purA(0.09) : group === "control loop" ? C.hitA(0.09) : C.accA(0.09)) : "transparent" }}
                          >
                            <span className="text-xs font-medium" style={{ color: active ? barColor : C.ink }}>{axis.label}</span>
                            <span className="h-1 overflow-hidden rounded-full bg-line/60">
                              <span className="block h-full rounded-full" style={{ width: `${demandBar(axis.value) * 100}%`, background: negative ? C.faint : barColor }} />
                            </span>
                            <span className="text-right font-mono text-[11px] tabular-nums" style={{ color: negative ? C.faint : barColor }}>{axis.value.toFixed(2)}</span>
                          </button>
                          {active ? (
                            <div className="border-t border-line/50 bg-paper-2/50 px-3 py-3" aria-live="polite">
                              <p className="text-xs leading-relaxed text-ink-soft">{axis.meaning}</p>
                              <p className="mt-2 text-[11px] text-ink-faint">Loaded by {axis.driver}.</p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </VizCard>
  );
}
