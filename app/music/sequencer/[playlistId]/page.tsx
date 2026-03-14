import { createMetadata } from "@/app/lib/metadata";
import { PlaylistSequencer } from "@/app/music/components/PlaylistSequencer";

interface PlaylistSequencerPageProps {
  params: Promise<{ playlistId: string }>;
}

export const metadata = createMetadata({
  title: "Playlist Sequencer",
  description:
    "Structure playlist flow with blocks, transitions, and sequencing assistance.",
  noIndex: true,
});

export default async function PlaylistSequencerPage({
  params,
}: PlaylistSequencerPageProps) {
  const { playlistId } = await params;

  return (
    <PlaylistSequencer
      playlistId={playlistId}
      backHref="/music/manage"
    />
  );
}
