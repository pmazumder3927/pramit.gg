// Sketchbook paper backdrop. Pure CSS, theme-aware.
// Faint corner washes give the paper warmth; the SongScape layer (a landscape
// generated from whatever's playing) carries the real atmosphere in both
// themes. Sits behind all content (z-0).
import SongScape from "./SongScape";

export default function PaperBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* sunset-orange wash, top-left — prominent on paper, a faint ember at night */}
      <div
        className="absolute -left-40 -top-48 h-[42rem] w-[42rem] rounded-full blur-3xl opacity-[0.10] dark:opacity-[0.07] animate-float"
        style={{ background: "radial-gradient(circle, rgb(var(--accent-orange)) 0%, transparent 68%)" }}
      />
      {/* flower-purple wash, bottom-right */}
      <div
        className="absolute -right-48 bottom-[-12rem] h-[46rem] w-[46rem] rounded-full blur-3xl opacity-[0.10] dark:opacity-[0.08] animate-float-delayed"
        style={{ background: "radial-gradient(circle, rgb(var(--accent-purple)) 0%, transparent 68%)" }}
      />
      {/* a third soft wash drifting mid-right for depth */}
      <div
        className="absolute right-[20%] top-[28%] h-[26rem] w-[26rem] rounded-full blur-3xl opacity-[0.06] dark:opacity-[0.05]"
        style={{ background: "radial-gradient(circle, rgb(var(--accent-rust)) 0%, transparent 70%)" }}
      />
      {/* faint notebook margin rule on the left */}
      <div
        className="absolute inset-y-0 left-[54px] w-px opacity-[0.5] hidden sm:block"
        style={{ background: "rgb(var(--accent-rust) / 0.16)" }}
      />

      {/* landscape generated from the now-playing track (both themes) */}
      <SongScape />
    </div>
  );
}
