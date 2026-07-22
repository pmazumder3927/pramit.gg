import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  createConfessionalCaptchaChallenge,
  resolveGallerySnapshot,
  verifyConfessionalCaptchaSubmission,
} from "@/app/lib/confessional-captcha-server";
import { createAdminClient } from "@/utils/supabase/admin";

const SNAPSHOT_BUCKET = "images";
const SNAPSHOT_PREFIX = "turtles";
const SNAPSHOT_MAX_BYTES = 4 * 1024 * 1024; // 4 MB — leaves room for dense
// drawings at high DPR. The Supabase storage default is 50MB so we're well
// under the platform cap.

export async function GET() {
  const payload = await createConfessionalCaptchaChallenge();
  return NextResponse.json(payload, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const { message, timestamp, captcha } = await request.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json(
        { error: "Message too long (max 500 characters)" },
        { status: 400 }
      );
    }

    const captchaResult = await verifyConfessionalCaptchaSubmission(captcha);
    if (!captchaResult.ok) {
      return NextResponse.json(
        { error: captchaResult.error },
        { status: 400 }
      );
    }

    // Service-role client: bypasses RLS so the storage upload to the
    // `images` bucket succeeds without needing an anon-write policy.
    const supabase = createAdminClient();
    const createdAt = timestamp || new Date().toISOString();

    const { error } = await supabase
      .from("confessional_messages")
      .insert([
        {
          message: message.trim(),
          created_at: createdAt,
          // No IP address or user identification stored for privacy
        },
      ]);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to store message" },
        { status: 500 }
      );
    }

    // Pre-generate the row id so the snapshot path can include it before
    // the row is inserted.
    const turtleId = randomUUID();
    let snapshotUrl: string | null = null;

    // Prefer the client's raster (it carries the real brush texture) but only
    // when it decodes and is within budget. resolveGallerySnapshot then keeps
    // it if it has transparency, or re-renders a transparent PNG from the
    // strokes if the browser baked an opaque background. Either way we upload a
    // gallery-safe snapshot, so a light-ink doodle can never land as a blank
    // white rectangle.
    let clientPng: Buffer | null = null;
    if (typeof captcha?.snapshot === "string") {
      const decoded = decodePngDataUrl(captcha.snapshot);
      if (!decoded) {
        console.warn(
          `[confessional] snapshot decode failed (prefix: ${captcha.snapshot.slice(
            0,
            48,
          )})`,
        );
      } else if (decoded.byteLength > SNAPSHOT_MAX_BYTES) {
        console.warn(
          `[confessional] snapshot rejected: ${decoded.byteLength} bytes exceeds ${SNAPSHOT_MAX_BYTES}`,
        );
      } else {
        clientPng = decoded;
      }
    }

    try {
      const buffer = await resolveGallerySnapshot(clientPng, captcha.strokes);
      const path = `${SNAPSHOT_PREFIX}/${turtleId}.png`;
      const { error: uploadError } = await supabase.storage
        .from(SNAPSHOT_BUCKET)
        .upload(path, buffer, {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000, immutable",
          upsert: false,
        });

      if (uploadError) {
        // Non-fatal — the strokes still render via the SVG fallback.
        console.error("[confessional] snapshot upload error:", uploadError);
      } else {
        const { data: publicUrl } = supabase.storage
          .from(SNAPSHOT_BUCKET)
          .getPublicUrl(path);
        snapshotUrl = publicUrl?.publicUrl ?? null;
        console.log(
          `[confessional] snapshot uploaded (${buffer.byteLength} bytes, ${
            clientPng ? "client" : "server-rendered"
          }) → ${snapshotUrl}`,
        );
      }
    } catch (snapshotError) {
      // Never fail the confession over the gallery snapshot.
      console.error("[confessional] snapshot render/upload error:", snapshotError);
    }

    // Don't fail the confession if the gallery insert fails.
    const { error: turtleError } = await supabase
      .from("turtle_drawings")
      .insert([
        {
          id: turtleId,
          strokes: captcha.strokes,
          prompt: captchaResult.challenge.drawingPrompt,
          created_at: createdAt,
          snapshot_url: snapshotUrl,
        },
      ]);

    if (turtleError) {
      console.error("Drawing save error:", turtleError);
    }

    return NextResponse.json(
      { success: true, message: "Message received" },
      { status: 200 }
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function decodePngDataUrl(value: string): Buffer | null {
  const prefix = "data:image/png;base64,";
  if (!value.startsWith(prefix)) return null;
  // Strip any whitespace defensively — some environments line-wrap base64.
  const base64 = value.slice(prefix.length).replace(/\s+/g, "");
  if (base64.length === 0) return null;
  try {
    const buffer = Buffer.from(base64, "base64");
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length < 8 ||
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47
    ) {
      return null;
    }
    return buffer;
  } catch {
    return null;
  }
}
