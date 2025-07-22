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

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check if file is an image, video, or HTML
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type === "video/mp4";
    const isHtml = file.type === "text/html" || file.name.endsWith(".html");
    
    if (!isImage && !isVideo && !isHtml) {
      return NextResponse.json(
        { error: "File must be an image, MP4 video, or HTML file" },
        { status: 400 }
      );
    }

    // Check file size (max 100MB for all media)
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size must be less than 100MB" },
        { status: 400 }
      );
    }

    // Create unique filename
    const fileExtension = file.name.split(".").pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}_${random}.${fileExtension}`;
    const filePath = `uploads/${fileName}`;

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(buffer);

    // Upload to images bucket (for all media)
    const { data, error } = await supabase.storage
      .from("images")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(filePath);

    return NextResponse.json({
      url: publicUrl,
      filename: fileName,
      size: file.size,
      type: file.type,
      isVideo,
      isHtml,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
