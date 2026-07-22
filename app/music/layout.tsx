import { createMetadata, siteConfig } from "@/app/lib/metadata";

export const metadata = createMetadata({
  title: "Music",
  description:
    "see what i'm listening to rn",
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
