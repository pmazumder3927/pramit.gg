// OpenAim essay figure pack — the custom tags used by the OpenAim post only.
// Every component is a next/dynamic split point, so a chunk loads ONLY on a
// page that actually renders its tag; other posts never pull this code.
//
// This is now a self-DESCRIBING catalog: alongside the component, each entry
// carries the human label, a one-line blurb, and its kind. The reader path
// (PostContent) only needs tag → component; the writing room reads the rest to
// make figures a first-class, browsable part of the pen (see post-widgets.tsx
// and app/write/Figures.tsx).
import dynamic from "next/dynamic";
import type { FigureDef } from "@/app/components/post-widgets";

export const openaimFigures: FigureDef[] = [
  // ---- interactive widgets ------------------------------------------------
  {
    tag: "submovement-lab",
    label: "the noise you can't see",
    blurb: "SNR slider — the hidden tremor emerges from a clean-looking flick.",
    kind: "interactive",
    component: dynamic(() => import("./SignalNoiseLab")),
  },
  {
    tag: "noise-frontier",
    label: "find your frontier",
    blurb: "drag your operating point along the speed–accuracy frontier.",
    kind: "interactive",
    component: dynamic(() => import("./NoiseFrontier")),
  },
  {
    tag: "challenge-point",
    label: "how hard should the next drill be?",
    blurb: "nudge the learned challenge zone without pretending the peak is universal.",
    kind: "interactive",
    component: dynamic(() => import("./ChallengePoint")),
  },
  {
    tag: "capability-radar",
    label: "the shape of your aim",
    blurb: "the 14-axis capability radar, live.",
    kind: "interactive",
    component: dynamic(() => import("./CapabilityRadar")),
  },
  {
    tag: "sens-spectrum",
    label: "the same aim, a different hand question",
    blurb: "pick a task, drag sensitivity, and see the physical demand tradeoff.",
    kind: "interactive",
    component: dynamic(() => import("./SensSpectrum")),
  },
  {
    tag: "aim-model-playground",
    label: "a drill and its fourteen demands",
    blurb: "watch one scenario, then inspect its compact fourteen-axis demand shape.",
    kind: "interactive",
    component: dynamic(() => import("./AimModelPlayground")),
  },
  {
    tag: "cheat-lab",
    label: "try to rob the grader",
    blurb: "adversarial bots vs the anti-exploit grade — flip the grader, see who profits.",
    kind: "interactive",
    component: dynamic(() => import("./CheatLab")),
  },
  {
    tag: "harness-replay",
    label: "synthetic players, real engine",
    blurb: "real engine runs, extracted from .oar replays and made scrubbable.",
    kind: "interactive",
    component: dynamic(() => import("./HarnessReplay")),
  },
  {
    tag: "servo-lab",
    label: "the servo-gaussian tracking assumption",
    blurb: "intermittent correction, reaction delay, Gaussian error, and deliberate model mismatch.",
    kind: "interactive",
    component: dynamic(() => import("./ServoLab")),
  },
  {
    tag: "ledger-collapse",
    label: "a run, averaged into one update",
    blurb: "real target engagements collapsing into the old run-level update.",
    kind: "interactive",
    component: dynamic(() => import("./LedgerCollapse")),
  },
  {
    tag: "submovement-fig",
    label: "one flick, decomposed",
    blurb: "a real captured flick, played back and split into reaction, ballistic launch, correction, and settle.",
    kind: "interactive",
    component: dynamic(() => import("./FlickAnatomy")),
  },
  // ---- theme-aware static diagrams ----------------------------------------
  {
    tag: "loop-fig",
    label: "one player model, one loop",
    blurb: "the closed diagnosis → prescription loop.",
    kind: "diagram",
    component: dynamic(() => import("./diagrams").then((m) => m.LoopFig)),
  },
  {
    tag: "input-recovery-fig",
    label: "what getCoalescedEvents() gives back",
    blurb: "raw 2 kHz samples recovered inside one render frame.",
    kind: "diagram",
    component: dynamic(() => import("./diagrams").then((m) => m.InputRecoveryFig)),
  },
  {
    tag: "miss-fingerprints-fig",
    label: "five ways to miss, five fingerprints",
    blurb: "where in the movement each failure mode breaks.",
    kind: "diagram",
    component: dynamic(() => import("./diagrams").then((m) => m.MissFingerprintsFig)),
  },
  {
    tag: "session-plan-fig",
    label: "a session is a plan, not a bag of picks",
    blurb: "the generated session spine, with progressive overload.",
    kind: "diagram",
    component: dynamic(() => import("./diagrams").then((m) => m.SessionPlanFig)),
  },
  {
    tag: "commons-fig",
    label: "a correlated prior beats a lonely guess",
    blurb: "the population manifold sharpening your estimate.",
    kind: "diagram",
    component: dynamic(() => import("./diagrams").then((m) => m.CommonsFig)),
  },
  {
    tag: "ledger-fig",
    label: "one fact stream, one fold, one spec",
    blurb: "the rewrite: engagement rows in, identical fold on both sides of the wire.",
    kind: "diagram",
    component: dynamic(() => import("./diagrams").then((m) => m.LedgerFig)),
  },
  {
    tag: "timeline-fig",
    label: "empty repo → trainer → teardown, in 5 days",
    blurb: "the build timeline: three days up, two days auditing and rebuilding the brain.",
    kind: "diagram",
    component: dynamic(() => import("./diagrams").then((m) => m.TimelineFig)),
  },
];
