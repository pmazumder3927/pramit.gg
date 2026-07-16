import { createMetadata, siteConfig } from "@/app/lib/metadata";

export const metadata = createMetadata({
  title: "Music",
  description:
    "Discover Pramit Mazumder's musical journey — current listening habits, favorite tracks, and musical inspirations.",
  image: siteConfig.ogImage,
  path: "/music",
});

export default function MusicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
