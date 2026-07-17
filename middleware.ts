import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// Routes that need Supabase auth session management
const AUTH_ROUTES = ["/dashboard", "/write", "/api/auth", "/api/dashboard", "/api/upload", "/api/write", "/music/manage"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only run Supabase session middleware on auth-dependent routes
  const needsAuth = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Draft preview also needs auth
  const isPreview = pathname.includes("/preview");

  if (needsAuth || isPreview) {
    return await updateSession(request);
  }

  return NextResponse.next();
}

export const config = {
  // Only the auth-gated surfaces need the session middleware; public pages,
  // RSC prefetches, and the 5s now-playing polls skip the edge hop entirely.
  // Keep this list in sync with AUTH_ROUTES above plus draft previews.
  matcher: [
    "/dashboard/:path*",
    "/write/:path*",
    "/api/auth/:path*",
    "/api/dashboard/:path*",
    "/api/upload/:path*",
    "/api/write/:path*",
    "/music/manage/:path*",
    "/post/:id/preview",
  ],
};
