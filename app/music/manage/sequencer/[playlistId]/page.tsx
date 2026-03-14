import { PlaylistSequencer } from "@/app/music/components/PlaylistSequencer";

interface MusicManageSequencerPageProps {
  params: Promise<{ playlistId: string }>;
}

export default async function MusicManageSequencerPage({
  params,
}: MusicManageSequencerPageProps) {
  const { playlistId } = await params;

  return (
    <PlaylistSequencer
      playlistId={playlistId}
      backHref="/music/manage"
    />
  );
}
