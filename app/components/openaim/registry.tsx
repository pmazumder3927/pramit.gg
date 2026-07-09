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
    blurb: "the challenge-point sweet spot, made playable.",
    kind: "interactive",
    component: dynamic(() => import("./ChallengePoint")),
  },
  {
    tag: "capability-radar",
    label: "the shape of your aim",
    blurb: "the five-axis capability radar, live.",
    kind: "interactive",
    component: dynamic(() => import("./CapabilityRadar")),
  },
  {
    tag: "sens-spectrum",
    label: "good at every sensitivity",
    blurb: "sweep the sens spectrum and watch the cost curve move.",
    kind: "interactive",
    component: dynamic(() => import("./SensSpectrum")),
  },
  // ---- theme-aware static diagrams ----------------------------------------
  {
    tag: "submovement-fig",
    label: "one flick, decomposed",
    blurb: "a flick split into a ballistic primary plus corrections.",
    kind: "diagram",
    component: dynamic(() => import("./diagrams").then((m) => m.SubmovementFig)),
  },
  {
    tag: "loop-fig",
    label: "one model, four engines, one loop",
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
    tag: "browser-pipeline-fig",
    label: "your data never leaves your machine",
    blurb: "the in-browser Pyodide analysis pipeline.",
    kind: "diagram",
    component: dynamic(() => import("./diagrams").then((m) => m.BrowserPipelineFig)),
  },
  {
    tag: "timeline-fig",
    label: "empty repo → deployed trainer, in 3 days",
    blurb: "the three-day build timeline, six phases deep.",
    kind: "diagram",
    component: dynamic(() => import("./diagrams").then((m) => m.TimelineFig)),
  },
];
