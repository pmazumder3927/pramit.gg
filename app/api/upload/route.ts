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

    const { fileName, fileType, fileSize } = await req.json();

    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json(
        { error: "fileName, fileType, and fileSize are required" },
        { status: 400 }
      );
    }

    // Check if file is an image, video, or HTML
    const isImage = fileType.startsWith("image/");
    const isVideo = fileType === "video/mp4";
    const isHtml = fileType === "text/html" || fileName.endsWith(".html");

    if (!isImage && !isVideo && !isHtml) {
      return NextResponse.json(
        { error: "File must be an image, MP4 video, or HTML file" },
        { status: 400 }
      );
    }

    // Check file size (max 100MB for all media)
    const MAX_FILE_SIZE = 100 * 1024 * 1024;

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size must be less than 100MB" },
        { status: 400 }
      );
    }

    // Create unique filename
    const fileExtension = fileName.split(".").pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const uniqueFileName = `${timestamp}_${random}.${fileExtension}`;
    const filePath = `uploads/${uniqueFileName}`;

    // Create presigned URL for upload
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage.from("images").createSignedUploadUrl(filePath);

    if (signedUrlError) {
      console.error("Supabase signed URL error:", signedUrlError);
      return NextResponse.json(
        { error: "Failed to create upload URL" },
        { status: 500 }
      );
    }

    // Get the public URL that will be available after upload
    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(filePath);

    return NextResponse.json({
      uploadUrl: signedUrlData.signedUrl,
      token: signedUrlData.token,
      path: signedUrlData.path,
      publicUrl,
      fileName: uniqueFileName,
      isVideo,
      isHtml,
    });
  } catch (error) {
    console.error("Upload URL generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
