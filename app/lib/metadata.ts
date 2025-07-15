import { Metadata } from "next";

const siteConfig = {
  name: "pramit.gg",
  description:
    "a living, evolving journal of interests, projects, and experiences",
  url: "https://pramit.gg",
  ogImage: "/og-image.jpg",
  creator: "@pramitmazumder",
  keywords: ["pramit", "mazumder", "blog", "portfolio", "music", "technology"],
};

export function createMetadata({
  title,
  description = siteConfig.description,
  image = siteConfig.ogImage,
  noIndex = false,
  ...props
}: {
  title: string;
  description?: string;
  image?: string;
  noIndex?: boolean;
} & Metadata): Metadata {
  return {
    title,
    description,
    keywords: siteConfig.keywords,
    authors: [{ name: "Pramit Mazumder", url: siteConfig.url }],
    creator: siteConfig.creator,
    openGraph: {
      type: "website",
      locale: "en_US",
      url: siteConfig.url,
      title,
      description,
      siteName: siteConfig.name,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      creator: siteConfig.creator,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    ...props,
  };
}

export { siteConfig };
