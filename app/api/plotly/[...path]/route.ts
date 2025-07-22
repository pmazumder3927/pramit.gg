import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Await the params since they're a Promise in Next.js 15
    const { path } = await params;
    // Reconstruct the full URL from the path segments
    const fullPath = path.join("/");
    const plotlyUrl = `https://${fullPath}`;

    // Fetch the HTML content from the storage URL
    const response = await fetch(plotlyUrl);
    
    if (!response.ok) {
      return new NextResponse("Graph not found", { status: 404 });
    }

    const htmlContent = await response.text();

    // Return the HTML with proper content-type headers
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (error) {
    console.error("Error serving Plotly graph:", error);
    return new NextResponse("Error loading graph", { status: 500 });
  }
}