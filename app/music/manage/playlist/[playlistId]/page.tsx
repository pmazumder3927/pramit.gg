import { Setlist } from "../../components/Setlist";

export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ playlistId: string }>;
}) {
  const { playlistId } = await params;
  return <Setlist playlistId={playlistId} />;
}
