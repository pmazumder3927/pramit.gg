import { siteConfig } from "./metadata";
import type { Post } from "./supabase";

const PERSON_ID = `${siteConfig.url}/#person`;
const WEBSITE_ID = `${siteConfig.url}/#website`;

/** Strip markdown to a plain-text excerpt for schema descriptions. */
function plainExcerpt(content: string, max = 250): string {
  const text = content
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*`_~>]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

// The author entity — referenced by @id everywhere so Google merges it into one
// stable identity (drives the "Pramit Mazumder" knowledge panel / sameAs links).
export const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": PERSON_ID,
  name: siteConfig.author,
  alternateName: "pramit",
  url: siteConfig.url,
  image: `${siteConfig.url}/me.jpg`,
  email: `mailto:${siteConfig.email}`,
  description: siteConfig.description,
  sameAs: siteConfig.sameAs,
} as const;

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: siteConfig.url,
  name: siteConfig.name,
  description: siteConfig.description,
  inLanguage: "en-US",
  publisher: { "@id": PERSON_ID },
  author: { "@id": PERSON_ID },
} as const;

export function articleSchema(post: Post, ogImage: string) {
  const url = `${siteConfig.url}/post/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.description || plainExcerpt(post.content),
    image: [ogImage],
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    author: { "@id": PERSON_ID },
    publisher: { "@id": PERSON_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    ...(post.tags?.length ? { keywords: post.tags.join(", ") } : {}),
    isPartOf: { "@id": WEBSITE_ID },
    inLanguage: "en-US",
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
