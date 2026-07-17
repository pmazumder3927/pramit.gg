"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// The single client-side dispatch point for every OpenAim figure. The dynamic()
// imports must live in a client module: the registry is also read by the
// server-rendered post body, and dynamic() evaluated in the RSC graph stops
// being a split point — the bundler folds every widget into the shared post
// chunk, which is exactly how ~25kB gz of essay figures ended up shipping with
// every post. From here each figure stays its own lazy chunk, fetched only
// when its tag actually renders.
const FIGURES: Record<string, ComponentType> = {
  // ---- interactive widgets ------------------------------------------------
  "submovement-lab": dynamic(() => import("./SignalNoiseLab")),
  "noise-frontier": dynamic(() => import("./NoiseFrontier")),
  "challenge-point": dynamic(() => import("./ChallengePoint")),
  "capability-radar": dynamic(() => import("./CapabilityRadar")),
  "sens-spectrum": dynamic(() => import("./SensSpectrum")),
  "aim-model-playground": dynamic(() => import("./AimModelPlayground")),
  "cheat-lab": dynamic(() => import("./CheatLab")),
  "harness-replay": dynamic(() => import("./HarnessReplay")),
  "servo-lab": dynamic(() => import("./ServoLab")),
  "ledger-collapse": dynamic(() => import("./LedgerCollapse")),
  "submovement-fig": dynamic(() => import("./FlickAnatomy")),
  // ---- theme-aware static diagrams ----------------------------------------
  "loop-fig": dynamic(() => import("./diagrams").then((m) => m.LoopFig)),
  "input-recovery-fig": dynamic(() =>
    import("./diagrams").then((m) => m.InputRecoveryFig),
  ),
  "miss-fingerprints-fig": dynamic(() =>
    import("./diagrams").then((m) => m.MissFingerprintsFig),
  ),
  "session-plan-fig": dynamic(() =>
    import("./diagrams").then((m) => m.SessionPlanFig),
  ),
  "commons-fig": dynamic(() => import("./diagrams").then((m) => m.CommonsFig)),
  "ledger-fig": dynamic(() => import("./diagrams").then((m) => m.LedgerFig)),
  "timeline-fig": dynamic(() =>
    import("./diagrams").then((m) => m.TimelineFig),
  ),
};

export default function FigureSlot({ tag }: { tag: string }) {
  const Figure = FIGURES[tag];
  return Figure ? <Figure /> : null;
}
