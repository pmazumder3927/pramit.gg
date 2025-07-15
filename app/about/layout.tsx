import { createMetadata } from "@/app/lib/metadata";

export const metadata = createMetadata({
  title: "About",
  description:
    "About Pramit Mazumder - Developer, creator, and digital explorer sharing insights on technology, music, and life.",
});

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
