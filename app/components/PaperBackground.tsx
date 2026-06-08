// Sketchbook paper backdrop. Pure CSS, theme-aware. Sits behind all content (z-0).
//   · PaperSheet — the handmade-paper ground (tooth, watermark, foxing, vignette).
//   · SongScapeInk — visitors' confessional doodles, inked (both themes).
import PaperSheet from "./PaperSheet";
import SongScapeInk from "./SongScapeInk";

export default function PaperBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* faint notebook margin rule on the left */}
      <div
        className="absolute inset-y-0 left-[54px] w-px opacity-[0.5] hidden sm:block"
        style={{ background: "rgb(var(--accent-rust) / 0.16)" }}
      />

      {/* the "Deckle" paper ground — tooth, watermark + foxing (seeded per song),
          a deckle vignette that deepens away from the song's light. */}
      <PaperSheet />

      {/* now-playing backdrop — visitors' confessional doodles, inked (both themes) */}
      <SongScapeInk />
    </div>
  );
}
