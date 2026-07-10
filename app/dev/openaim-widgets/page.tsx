// Dev-only preview of the OpenAim essay widgets + diagrams, so they can be
// eyeballed (and theme-checked) outside a full post. Not linked anywhere.
import SignalNoiseLab from "@/app/components/openaim/SignalNoiseLab";
import NoiseFrontier from "@/app/components/openaim/NoiseFrontier";
import ChallengePoint from "@/app/components/openaim/ChallengePoint";
import CapabilityRadar from "@/app/components/openaim/CapabilityRadar";
import SensSpectrum from "@/app/components/openaim/SensSpectrum";
import CheatLab from "@/app/components/openaim/CheatLab";
import {
  SubmovementFig,
  LoopFig,
  InputRecoveryFig,
  MissFingerprintsFig,
  SessionPlanFig,
  CommonsFig,
  LedgerFig,
  TimelineFig,
} from "@/app/components/openaim/diagrams";

export const metadata = { title: "openaim widgets — preview" };

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="mb-2 font-serif text-3xl text-ink">openaim — widgets</h1>
      <SignalNoiseLab />
      <NoiseFrontier />
      <ChallengePoint />
      <CapabilityRadar />
      <SensSpectrum />
      <CheatLab />
      <h1 className="mb-2 mt-12 font-serif text-3xl text-ink">openaim — diagrams</h1>
      <SubmovementFig />
      <LoopFig />
      <InputRecoveryFig />
      <MissFingerprintsFig />
      <SessionPlanFig />
      <CommonsFig />
      <LedgerFig />
      <TimelineFig />
    </main>
  );
}
