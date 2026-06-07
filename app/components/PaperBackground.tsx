// Sketchbook paper backdrop. Pure CSS, theme-aware.
// Faint corner washes give the paper warmth; the SongScapeInk layer (sumi-no-mizu
// calligraphy generated from whatever's playing) carries the real atmosphere in
// both themes. Sits behind all content (z-0).
import SongScapeInk from "./SongScapeInk";

export default function PaperBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Ambient base wash — moved off the scrolling body onto this fixed layer
          so it doesn't repaint on every scroll frame. Light: warm paper glow.
          Dark: desk-lamp glow + purple pool + a vignette closing in the edges. */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(1200px 680px at 12% -6%, rgb(var(--accent-orange) / 0.06), transparent 60%)," +
            "radial-gradient(1100px 640px at 92% 108%, rgb(var(--accent-purple) / 0.06), transparent 62%)",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage:
            "radial-gradient(1200px 760px at 50% -14%, rgb(var(--accent-orange) / 0.085), transparent 56%)," +
            "radial-gradient(960px 640px at 6% 2%, rgb(var(--accent-orange) / 0.05), transparent 60%)," +
            "radial-gradient(1100px 760px at 96% 106%, rgb(var(--accent-purple) / 0.10), transparent 60%)," +
            "radial-gradient(150% 130% at 50% 38%, transparent 52%, rgb(6 6 11 / 0.6) 100%)",
        }}
      />

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

      {/* now-playing backdrop — sumi-no-mizu calligraphy (both themes) */}
      <SongScapeInk />
    </div>
  );
}
