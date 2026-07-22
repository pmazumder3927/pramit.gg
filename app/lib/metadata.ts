import { Metadata } from "next";

const siteConfig = {
  name: "pramit.gg",
  // Used for the Person / author entity (knowledge-graph disambiguation)
  author: "Pramit Mazumder",
  description:
    "the sights and ramblings of a life in progress",
  // www is the primary host (Vercel-recommended: CNAME routing + cookie
  // isolation from *.pramit.gg side projects); apex 308s here.
  url: "https://www.pramit.gg",
  // Default social card is now generated at /opengraph-image (see app/opengraph-image.tsx)
  ogImage: "/opengraph-image",
  creator: "@PramitMazumder",
  email: "me@pramit.gg",
  keywords: [
    "pramit",
    "pramit mazumder",
    "pramit.gg",
    "mazumder",
    "blog",
    "portfolio",
    "music",
    "technology",
    "reinforcement learning",
    "robotics",
  ],
  // Verified profiles — power the `sameAs` entity links for the knowledge panel
  sameAs: [
    "https://github.com/pmazumder3927",
    "https://www.instagram.com/mazoomzoom/",
  ],
};

export function createMetadata({
  title,
  description = siteConfig.description,
  image,
  path,
  noIndex = false,
  ...props
}: {
  title: string;
  description?: string;
  /** Custom social image URL. When omitted, the route's generated opengraph-image is used. */
  image?: string;
  /** Site-relative path (e.g. "/music") used for the canonical + og:url. */
  path?: string;
  noIndex?: boolean;
} & Metadata): Metadata {
  // Pull openGraph out of overrides so we deep-merge rather than clobber it
  const { openGraph: ogOverrides, twitter: twitterOverrides, ...rest } = props;
  const url = path ? `${siteConfig.url}${path}` : siteConfig.url;

  return {
    title,
    description,
    keywords: siteConfig.keywords,
    authors: [{ name: siteConfig.author, url: siteConfig.url }],
    creator: siteConfig.creator,
    // Pages that set a path replace the root `alternates` wholesale (Next
    // merges metadata shallowly), so the feed link must ride along here too.
    ...(path
      ? {
          alternates: {
            canonical: path,
            types: {
              "application/atom+xml": [
                { url: "/feed.xml", title: `${siteConfig.name} · atom feed` },
              ],
            },
          },
        }
      : {}),
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      title,
      description,
      siteName: siteConfig.name,
      ...(image
        ? { images: [{ url: image, width: 1200, height: 630, alt: title }] }
        : {}),
      ...ogOverrides,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: siteConfig.creator,
      ...(image ? { images: [image] } : {}),
      ...twitterOverrides,
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
    ...rest,
  };
}

export { siteConfig };
