import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { createPublicClient } from "@/utils/supabase/server";
import { siteConfig } from "@/app/lib/metadata";

// Re-render the feed at most once an hour (route stays static between posts).
export const revalidate = 3600;

// Mirrors the PostContent pipeline minus katex/highlight — feed readers don't
// load our CSS, so TeX and code come through as plain text/<pre>.
const markdown = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeStringify);

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const supabase = createPublicClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("slug, title, description, content, created_at, updated_at")
    .eq("is_draft", false)
    .order("created_at", { ascending: false });

  const entries = await Promise.all(
    (posts ?? []).map(async (post) => {
      const url = `${siteConfig.url}/post/${post.slug}`;
      const published = new Date(post.created_at).toISOString();
      const updated = new Date(post.updated_at || post.created_at).toISOString();
      const html = String(await markdown.process(post.content ?? ""));

      return [
        "  <entry>",
        `    <title>${xml(post.title)}</title>`,
        `    <id>${url}</id>`,
        `    <link rel="alternate" type="text/html" href="${url}"/>`,
        `    <published>${published}</published>`,
        `    <updated>${updated}</updated>`,
        ...(post.description
          ? [`    <summary>${xml(post.description)}</summary>`]
          : []),
        `    <content type="html">${xml(html)}</content>`,
        "  </entry>",
      ].join("\n");
    })
  );

  const feedUpdated = posts?.length
    ? new Date(
        Math.max(
          ...posts.map((p) =>
            new Date(p.updated_at || p.created_at).getTime()
          )
        )
      ).toISOString()
    : new Date().toISOString();

  const feed = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${xml(siteConfig.name)}</title>`,
    `  <subtitle>${xml(siteConfig.description)}</subtitle>`,
    `  <id>${siteConfig.url}/</id>`,
    `  <link rel="alternate" type="text/html" href="${siteConfig.url}"/>`,
    `  <link rel="self" type="application/atom+xml" href="${siteConfig.url}/feed.xml"/>`,
    `  <updated>${feedUpdated}</updated>`,
    "  <author>",
    `    <name>${xml(siteConfig.author)}</name>`,
    `    <uri>${siteConfig.url}</uri>`,
    "  </author>",
    `  <icon>${siteConfig.url}/icon.svg</icon>`,
    ...entries,
    "</feed>",
  ].join("\n");

  return new Response(feed, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
    },
  });
}
