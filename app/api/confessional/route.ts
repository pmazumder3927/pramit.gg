import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  createConfessionalCaptchaChallenge,
  verifyConfessionalCaptchaSubmission,
} from "@/app/lib/confessional-captcha-server";
import { createPublicClient } from "@/utils/supabase/server";

const SNAPSHOT_BUCKET = "images";
const SNAPSHOT_PREFIX = "turtles";
const SNAPSHOT_MAX_BYTES = 500 * 1024; // 500 KB

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

    const supabase = createPublicClient();
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

    if (typeof captcha?.snapshot === "string") {
      const buffer = decodePngDataUrl(captcha.snapshot);
      if (buffer && buffer.byteLength <= SNAPSHOT_MAX_BYTES) {
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
          console.error("Snapshot upload error:", uploadError);
        } else {
          const { data: publicUrl } = supabase.storage
            .from(SNAPSHOT_BUCKET)
            .getPublicUrl(path);
          snapshotUrl = publicUrl?.publicUrl ?? null;
        }
      } else if (buffer && buffer.byteLength > SNAPSHOT_MAX_BYTES) {
        console.warn(
          `Snapshot rejected: ${buffer.byteLength} bytes exceeds ${SNAPSHOT_MAX_BYTES}`,
        );
      }
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
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  try {
    const buffer = Buffer.from(match[1], "base64");
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
