// Sketchbook paper backdrop. Pure CSS, theme-aware. Everything here is driven by
// the now-playing song so the whole page reflects it as one cohesive world:
//   · AlbumLight — the cover's own colour composition becomes the atmosphere +
//                  light, blended onto the orange/purple poles.
//   · PaperSheet — the handmade-paper ground; its vignette obeys AlbumLight's light.
//   · SongScapeInk — visitors' confessional doodles, inked in the cover's colours.
import AlbumLight from "./AlbumLight";
import PaperSheet from "./PaperSheet";
import SongScapeInk from "./SongScapeInk";

export default function PaperBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* the song's light — the album cover's colours, at their real positions,
          washed across the page and blended onto the warm/cool poles. */}
      <AlbumLight />

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
