import { createMetadata } from "@/app/lib/metadata";

export const metadata = createMetadata({
  title: "Music",
  description:
    "Discover Pramit Mazumder's musical journey — current listening habits, favorite tracks, and musical inspirations.",
  path: "/music",
});

export default function MusicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
