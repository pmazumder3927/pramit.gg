export type AxisId =
  | "fitts"
  | "temporal"
  | "reactivity"
  | "stability"
  | "switching"
  | "vertical"
  | "armControl"
  | "microControl"
  | "handPrecision"
  | "handSpeed"
  | "pacePressure"
  | "smoothPursuit"
  | "reacquire"
  | "cadence";

export type AxisGroup = "screen + timing" | "physical hand" | "control loop";

export type TaskVector = {
  A: number;
  W: number;
  v: number;
  lam: number;
  smooth: number;
  holdS: number;
  n: number;
  vert: number;
  cm360: number;
  pace: number;
  hp: number;
  dash: number;
  jump: number;
  depthVar: number;
  tall: number;
};

export type AxisMeta = {
  id: AxisId;
  label: string;
  short: string;
  group: AxisGroup;
  meaning: string;
  formula: string;
  driver: string;
};

export type AxisDemand = AxisMeta & { value: number };

export type ScenarioPreset = {
  id: string;
  label: string;
  note: string;
  task: Omit<TaskVector, "cm360">;
};

export const HAND_THRESHOLDS = {
  armCm: 3.5,
  microCm: 1.2,
  precisionCm: 0.28,
  speedCmS: 1.5,
} as const;

export const AXIS_META: AxisMeta[] = [
  {
    id: "fitts",
    label: "spatial precision",
    short: "land the flick",
    group: "screen + timing",
    meaning: "Landing the first movement on a target that is small relative to how far away it is.",
    formula: "log₂(A / W + 1), reduced for tracking holds",
    driver: "farther hops and smaller targets",
  },
  {
    id: "temporal",
    label: "interception timing",
    short: "meet the window",
    group: "screen + timing",
    meaning: "Clicking while a moving target is inside the crosshair instead of merely passing through it.",
    formula: "target speed / (10 × target width)",
    driver: "fast movers and narrow click windows",
  },
  {
    id: "reactivity",
    label: "reactive correction",
    short: "answer a reversal",
    group: "control loop",
    meaning: "Correcting after motion becomes surprising: a snap reversal or a depth-driven speed change.",
    formula: "reversals × speed / (15 × width)",
    driver: "unpredictable direction changes",
  },
  {
    id: "stability",
    label: "sustained stability",
    short: "stay on target",
    group: "control loop",
    meaning: "Keeping the crosshair on a target continuously while the scenario requires a hold.",
    formula: "hold time × (1 + crossing rate) / 2",
    driver: "longer holds on moving targets",
  },
  {
    id: "switching",
    label: "multi-target planning",
    short: "choose the next one",
    group: "screen + timing",
    meaning: "Planning and committing when several live targets compete for the next movement.",
    formula: "(live targets − 1) / 2",
    driver: "more simultaneous targets",
  },
  {
    id: "vertical",
    label: "vertical control",
    short: "leave the horizon",
    group: "screen + timing",
    meaning: "Controlling vertical offsets and motion instead of solving everything on one horizontal rail.",
    formula: "vertical share, with jump and shape gates",
    driver: "vertical motion and jumping targets",
  },
  {
    id: "armControl",
    label: "arm-range control",
    short: "move several cm",
    group: "physical hand",
    meaning: "Large physical sweeps. The model begins loading this when one acquisition travels beyond 3.5 cm.",
    formula: "ln((A × cm360 / 360) / 3.5)⁺ / ln(3)",
    driver: "wide angles at slower sensitivity",
  },
  {
    id: "microControl",
    label: "micro control",
    short: "move about a cm",
    group: "physical hand",
    meaning: "Tiny physical corrections that stay inside the model's finger/wrist-scale movement regime.",
    formula: "ln(1.2 / (A × cm360 / 360))⁺ / ln(3)",
    driver: "small angles at faster sensitivity",
  },
  {
    id: "handPrecision",
    label: "fine-hand precision",
    short: "land in a tiny window",
    group: "physical hand",
    meaning: "How small the target's landing window is in physical mouse space. Faster sens shrinks that window.",
    formula: "ln(0.28 / (W × cm360 / 360))⁺ / ln(2.5)",
    driver: "small targets at faster sensitivity",
  },
  {
    id: "handSpeed",
    label: "hand speed",
    short: "cover cm quickly",
    group: "physical hand",
    meaning: "The physical mouse velocity required to keep up. Slower sens turns the same angular speed into more cm/s.",
    formula: "ln((v × cm360 / 360) / 1.5)⁺ / ln(3)",
    driver: "fast targets at slower sensitivity",
  },
  {
    id: "pacePressure",
    label: "pace pressure",
    short: "finish on budget",
    group: "screen + timing",
    meaning: "The scenario's time budget relative to a natural pace. Relaxed drills can carry a negative load.",
    formula: "ln(1 / pace) / 0.25",
    driver: "tighter completion budgets",
  },
  {
    id: "smoothPursuit",
    label: "smooth pursuit",
    short: "follow readable motion",
    group: "control loop",
    meaning: "Continuously cancelling error against motion that can be predicted rather than merely reacted to.",
    formula: "readability × (1 − reversals) × crossing rate",
    driver: "smooth, predictable target motion",
  },
  {
    id: "reacquire",
    label: "reacquisition",
    short: "find it again",
    group: "control loop",
    meaning: "Re-locking after a blink or teleport forces the movement plan to restart from scratch.",
    formula: "blink rate × (1 + A / 16) / 0.8",
    driver: "frequent, distant displacements",
  },
  {
    id: "cadence",
    label: "repeat-shot control",
    short: "commit to a rhythm",
    group: "screen + timing",
    meaning: "Repeating accurate shots at a committed cadence instead of waiting indefinitely for each click.",
    formula: "(hits to kill − 1) / 2 × (1 + crossing rate)",
    driver: "multi-tap moving targets",
  },
];

const base = {
  lam: 0,
  smooth: 0,
  holdS: 0,
  n: 1,
  vert: 0.08,
  pace: 1,
  hp: 1,
  dash: 0,
  jump: 0,
  depthVar: 0,
  tall: 0,
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "micro",
    label: "micro flick",
    note: "A tiny correction into a small landing window.",
    task: { ...base, A: 5, W: 0.8, v: 0, pace: 0.9 },
  },
  {
    id: "wide",
    label: "wide switch",
    note: "Several targets, a long sweep, then a clean landing.",
    task: { ...base, A: 42, W: 2.1, v: 0, n: 4, pace: 0.86, vert: 0.22 },
  },
  {
    id: "smooth",
    label: "smooth track",
    note: "Stay attached to readable motion instead of chasing it.",
    task: { ...base, A: 20, W: 2.2, v: 28, smooth: 1, holdS: 0.7, pace: 0.95 },
  },
  {
    id: "reactive",
    label: "reactive track",
    note: "The target reverses before prediction can settle.",
    task: { ...base, A: 24, W: 1.7, v: 38, lam: 2.1, smooth: 0.12, holdS: 0.65, vert: 0.3 },
  },
  {
    id: "blink",
    label: "blink reacquire",
    note: "Every teleport asks for a fresh movement plan.",
    task: { ...base, A: 28, W: 1.3, v: 10, dash: 0.48, pace: 0.88, vert: 0.2 },
  },
  {
    id: "burst",
    label: "3-tap strafe",
    note: "Intercept, fire three controlled shots, then switch.",
    task: { ...base, A: 18, W: 1.5, v: 24, lam: 0.55, smooth: 0.55, n: 2, hp: 3, pace: 0.84 },
  },
];

export function clamp(value: number, lo = 0, hi = 1) {
  return Math.min(hi, Math.max(lo, value));
}

export function handSpace(task: Pick<TaskVector, "A" | "W" | "v" | "cm360">) {
  return {
    travelCm: (task.A * task.cm360) / 360,
    targetCm: (task.W * task.cm360) / 360,
    speedCmS: (task.v * task.cm360) / 360,
  };
}

/**
 * The article's local projection of OpenAim's basis-v1 + Lambda0 demand map.
 * Values are raw scenario demand (not skill and not percentages).
 */
export function axisDemands(task: TaskVector): AxisDemand[] {
  const A = Math.max(0.01, task.A);
  const W = Math.max(0.05, task.W);
  const { travelCm, targetCm, speedCmS } = handSpace(task);
  const widthRate = task.v / (10 * W);
  const crossingRate = Math.min(2, widthRate);
  const acuity = Math.min(1, 2.2 / Math.max(W, 0.3));
  const isHold = task.holdS > 0;
  const idFitts = Math.min(2, Math.log2(A / W + 1) / 3);
  const reversal = Math.min(
    2,
    (task.lam * task.v) / (15 * W) + 0.6 * task.depthVar * Math.min(1.5, crossingRate),
  );
  const holdLoad = (task.holdS * (1 + task.v / (10 * W))) / 2;
  const switchLoad = Math.min(2, (task.n - 1) / 2);
  const vertical = Math.min(1.5, Math.max(task.vert, 0.45 * task.jump) / 0.4) * (1 - 0.6 * task.tall);
  const arm = Math.max(0, Math.log(Math.max(1e-6, travelCm) / HAND_THRESHOLDS.armCm)) / Math.log(3);
  const micro = Math.max(0, Math.log(HAND_THRESHOLDS.microCm / Math.max(1e-6, travelCm))) / Math.log(3);
  const precision = Math.min(
    2,
    Math.max(0, Math.log(HAND_THRESHOLDS.precisionCm / Math.max(1e-6, targetCm))) / Math.log(2.5),
  );
  const handSpeed = Math.min(
    2,
    Math.max(0, Math.log(Math.max(1e-6, speedCmS) / HAND_THRESHOLDS.speedCmS)) / Math.log(3) +
      0.4 * task.depthVar,
  );
  const pace = Math.log(1 / Math.max(0.05, task.pace)) / 0.25;
  const pursuit =
    Math.min(2, 1.4 * task.smooth * Math.max(0, 1 - task.lam) * widthRate * (isHold ? 1 : 0.4)) * acuity;
  const reacquire = Math.min(2, (task.dash * (1 + A / 16)) / 0.8);
  const cadence = Math.min(2, ((task.hp - 1) / 2) * (1 + task.v / (10 * W))) * acuity;

  const values: Record<AxisId, number> = {
    fitts: idFitts * (isHold ? 0.35 : 1),
    temporal: crossingRate * (isHold ? 0.4 : 1),
    reactivity: reversal,
    stability: holdLoad * acuity,
    switching: switchLoad * acuity,
    vertical,
    armControl: arm,
    microControl: micro,
    handPrecision: precision,
    handSpeed,
    pacePressure: pace,
    smoothPursuit: pursuit,
    reacquire,
    cadence,
  };

  return AXIS_META.map((axis) => ({ ...axis, value: values[axis.id] }));
}

export function demandBar(value: number) {
  if (value < 0) return clamp(Math.abs(value) / 1.5);
  return clamp(value / 1.5);
}

export function effectorLabel(travelCm: number) {
  if (travelCm < HAND_THRESHOLDS.microCm) return "micro / finger-wrist proxy";
  if (travelCm > HAND_THRESHOLDS.armCm) return "arm-range proxy";
  return "wrist / forearm transition";
}
