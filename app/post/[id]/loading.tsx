import { TornEdge, PaperClip } from "@/app/components/sketchbook";

// Route-transition state for slow fetches (unprefetched taps, ISR
// regeneration): the same journal sheet, ruled but not yet written — no
// spinner, just paper waiting for ink.
export default function Loading() {
  const rules = [
    "w-full",
    "w-11/12",
    "w-full",
    "w-4/5",
    "w-full",
    "w-10/12",
    "w-3/5",
  ];
  return (
    <div className="min-h-screen py-8 sm:py-10 md:py-16">
      <div className="mx-auto w-full max-w-[40rem] px-4 sm:max-w-[44rem] sm:px-6">
        <div className="relative rounded-[3px] border border-line bg-card px-6 py-11 shadow-paper-lg sm:px-10 md:px-16 md:py-14">
          <TornEdge position="top" />
          <TornEdge position="bottom" />
          <PaperClip className="-top-5 right-8 md:right-12" rotate={9} tone="ink" />
          <span className="font-hand text-2xl -rotate-1 text-accent-purple">
            from the journal —
          </span>
          <div aria-hidden className="mt-10 space-y-7">
            {rules.map((w, i) => (
              <div key={i} className={`h-px ${w} bg-line/80`} />
            ))}
          </div>
          <p className="mt-10 font-hand text-lg text-ink-faint">
            fetching this entry…
          </p>
        </div>
      </div>
    </div>
  );
}
