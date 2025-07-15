import { createMetadata } from "@/app/lib/metadata";

export const metadata = createMetadata({
  title: "Music",
  description:
    "Discover Pramit's musical journey - current listening habits, favorite tracks, and musical inspirations.",
});

export default function MusicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
