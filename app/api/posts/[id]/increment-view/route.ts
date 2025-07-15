import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Increment view count
    const { data, error } = await supabase
      .from("posts")
      .select("view_count")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching current view count:", error);
      return NextResponse.json(
        { error: "Failed to fetch view count" },
        { status: 500 }
      );
    }

    const newViewCount = (data.view_count || 0) + 1;

    const { error: updateError } = await supabase
      .from("posts")
      .update({ view_count: newViewCount })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating view count:", updateError);
      return NextResponse.json(
        { error: "Failed to update view count" },
        { status: 500 }
      );
    }

    return NextResponse.json({ view_count: newViewCount });
  } catch (error) {
    console.error("Error in increment-view API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
