import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  try {
    // Create server-side Supabase client with authentication
    const supabase = await createClient();

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { path, fileName, publicUrl, isVideo, isHtml } = await req.json();

    if (!path || !fileName || !publicUrl) {
      return NextResponse.json(
        { error: "path, fileName, and publicUrl are required" },
        { status: 400 }
      );
    }

    // Verify the file was actually uploaded by checking if it exists
    const { data: fileData, error: fileError } = await supabase.storage
      .from("images")
      .list("uploads", {
        search: fileName,
      });

    if (fileError || !fileData?.length) {
      return NextResponse.json(
        { error: "Upload verification failed" },
        { status: 400 }
      );
    }

    // Here you can add any post-upload processing:
    // - Save metadata to database
    // - Trigger image processing
    // - Send notifications
    // - etc.

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
      isVideo,
      isHtml,
    });
  } catch (error) {
    console.error("Upload completion error:", error);
    return NextResponse.json(
      { error: "Upload completion failed" },
      { status: 500 }
    );
  }
}
