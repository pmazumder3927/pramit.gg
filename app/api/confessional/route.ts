import { NextRequest, NextResponse } from "next/server";

import {
  createConfessionalCaptchaChallenge,
  verifyConfessionalCaptchaSubmission,
} from "@/app/lib/confessional-captcha-server";
import { createPublicClient } from "@/utils/supabase/server";

export async function GET() {
  return NextResponse.json(createConfessionalCaptchaChallenge(), { status: 200 });
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

    const captchaResult = verifyConfessionalCaptchaSubmission(captcha);
    if (!captchaResult.ok) {
      return NextResponse.json(
        { error: captchaResult.error },
        { status: 400 }
      );
    }

    const supabase = createPublicClient();

    // Store the message in Supabase
    const { error } = await supabase
      .from("confessional_messages")
      .insert([
        {
          message: message.trim(),
          created_at: timestamp || new Date().toISOString(),
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

    return NextResponse.json(
      { success: true, message: "Message received" },
      { status: 200 }
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
