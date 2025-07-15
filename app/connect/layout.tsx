import { createMetadata } from "@/app/lib/metadata";

export const metadata = createMetadata({
  title: "Connect",
  description:
    "Connect with Pramit Mazumder - Get in touch through various channels and stay updated with the latest.",
});

export default function ConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
