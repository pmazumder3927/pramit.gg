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

    // Check if file is an image or video
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type === "video/mp4";
    
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: "File must be an image or MP4 video" },
        { status: 400 }
      );
    }

    // Check file size (max 25MB for images, 100MB for videos)
    const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
    
    if (isImage && file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "Image size must be less than 25MB" },
        { status: 400 }
      );
    }
    
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: "Video size must be less than 100MB" },
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

    // Upload to appropriate Supabase Storage bucket
    // For videos, try videos bucket first, fallback to images bucket
    let bucketName = isImage ? "images" : "videos";
    let { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    // If videos bucket doesn't exist, fallback to images bucket
    if (error && isVideo && error.message.includes("bucket")) {
      console.warn("Videos bucket not found, falling back to images bucket");
      bucketName = "images";
      ({ data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType: file.type,
          upsert: false,
        }));
    }

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    return NextResponse.json({
      url: publicUrl,
      filename: fileName,
      size: file.size,
      type: file.type,
      isVideo,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
