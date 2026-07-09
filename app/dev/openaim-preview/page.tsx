// Dev-only preview of the OpenAim essay widgets, so they can be eyeballed
// outside a full post. Not linked anywhere; mirrors app/dev/cover-paint.
import SignalNoiseLab from "@/app/components/openaim/SignalNoiseLab";
import NoiseFrontier from "@/app/components/openaim/NoiseFrontier";
import ChallengePoint from "@/app/components/openaim/ChallengePoint";
import CapabilityRadar from "@/app/components/openaim/CapabilityRadar";
import SensSpectrum from "@/app/components/openaim/SensSpectrum";

export const metadata = { title: "openaim widgets — preview" };

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="mb-8 font-serif text-3xl text-ink">openaim widgets — preview</h1>
      <SignalNoiseLab />
      <NoiseFrontier />
      <ChallengePoint />
      <CapabilityRadar />
      <SensSpectrum />
    </main>
  );
}
