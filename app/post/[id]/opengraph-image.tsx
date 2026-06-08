import { ImageResponse } from "next/og";
import { createPublicClient } from "@/utils/supabase/server";
import { siteConfig } from "@/app/lib/metadata";

export const alt = "pramit.gg post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TYPE_LABEL: Record<string, string> = {
  musing: "a musing",
  journey: "a journey",
  note: "a note",
};

// Per-post social card built from the post title. Used whenever a post has no
// explicit meta_image (see generateMetadata in page.tsx).
export default async function PostOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let title = siteConfig.name;
  let type = "";
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("posts")
      .select("title, type")
      .eq("slug", id)
      .eq("is_draft", false)
      .single();
    if (data) {
      title = data.title;
      type = TYPE_LABEL[data.type] ?? "";
    }
  } catch {
    // fall back to the brand title
  }

  // Scale the headline down for very long titles so it always fits.
  const fontSize = title.length > 60 ? 64 : title.length > 36 ? 80 : 96;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#f4ecd8",
          backgroundImage:
            "radial-gradient(circle at 15% 15%, rgba(255,107,61,0.16), transparent 45%), radial-gradient(circle at 88% 90%, rgba(139,109,196,0.13), transparent 45%)",
          padding: "80px",
          fontFamily: "serif",
          color: "#2b2620",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "30px",
            color: "#8a8175",
          }}
        >
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "999px",
              backgroundColor: "#ff6b3d",
            }}
          />
          {siteConfig.name}
          {type ? `  ·  ${type}` : ""}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: "-1.5px",
            maxWidth: "1000px",
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", fontSize: "30px", color: "#6b6256" }}>
          {siteConfig.author}
        </div>
      </div>
    ),
    { ...size },
  );
}
