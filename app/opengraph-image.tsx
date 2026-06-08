import { ImageResponse } from "next/og";
import { siteConfig } from "./lib/metadata";

export const alt = "pramit.gg · Pramit Mazumder";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Sitewide default social card. Inherited by every route that doesn't define
// its own opengraph-image, so no share ever 404s on a missing static file.
export default function OgImage() {
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
            "radial-gradient(circle at 20% 18%, rgba(255,107,61,0.14), transparent 42%), radial-gradient(circle at 84% 88%, rgba(139,109,196,0.14), transparent 45%)",
          padding: "80px",
          fontFamily: "serif",
          color: "#2b2620",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "999px",
              backgroundColor: "#ff6b3d",
            }}
          />
          <div style={{ fontSize: "34px", letterSpacing: "-0.5px" }}>
            {siteConfig.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: "92px",
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-2px",
            }}
          >
            Pramit Mazumder
          </div>
          <div
            style={{
              fontSize: "38px",
              fontStyle: "italic",
              color: "#6b6256",
              maxWidth: "880px",
              lineHeight: 1.25,
            }}
          >
            {siteConfig.description}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: "30px",
            color: "#8a8175",
          }}
        >
          pramit.gg
        </div>
      </div>
    ),
    { ...size },
  );
}
