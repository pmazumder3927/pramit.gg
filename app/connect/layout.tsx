import { createMetadata, siteConfig } from "@/app/lib/metadata";
import JsonLd from "@/app/components/JsonLd";
import { personSchema } from "@/app/lib/structured-data";

export const metadata = createMetadata({
  title: "Connect",
  description:
    "connect with the one really cool guy with a blog",
  image: siteConfig.ogImage,
  path: "/connect",
});

// Mark this as the canonical profile page for the Person entity.
const profilePageSchema = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  url: `${siteConfig.url}/connect`,
  mainEntity: { "@id": `${siteConfig.url}/#person` },
  about: personSchema,
};

export default function ConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={profilePageSchema} />
      {children}
    </>
  );
}
