// OpenAim essay widget pack — the custom tags used by the OpenAim post only.
// Every entry is a next/dynamic split point, so these chunks load ONLY on a
// page that actually renders the tag; other posts never pull this code.
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const openaimWidgets: Record<string, ComponentType> = {
  // interactive widgets
  "submovement-lab": dynamic(() => import("./SignalNoiseLab")),
  "noise-frontier": dynamic(() => import("./NoiseFrontier")),
  "challenge-point": dynamic(() => import("./ChallengePoint")),
  "capability-radar": dynamic(() => import("./CapabilityRadar")),
  "sens-spectrum": dynamic(() => import("./SensSpectrum")),
  // theme-aware static diagrams
  "submovement-fig": dynamic(() => import("./diagrams").then((m) => m.SubmovementFig)),
  "loop-fig": dynamic(() => import("./diagrams").then((m) => m.LoopFig)),
  "input-recovery-fig": dynamic(() => import("./diagrams").then((m) => m.InputRecoveryFig)),
  "miss-fingerprints-fig": dynamic(() => import("./diagrams").then((m) => m.MissFingerprintsFig)),
  "session-plan-fig": dynamic(() => import("./diagrams").then((m) => m.SessionPlanFig)),
  "commons-fig": dynamic(() => import("./diagrams").then((m) => m.CommonsFig)),
  "browser-pipeline-fig": dynamic(() => import("./diagrams").then((m) => m.BrowserPipelineFig)),
  "timeline-fig": dynamic(() => import("./diagrams").then((m) => m.TimelineFig)),
};
