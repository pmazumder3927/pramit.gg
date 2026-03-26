import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// Routes that need Supabase auth session management
const AUTH_ROUTES = ["/dashboard", "/api/auth", "/api/dashboard", "/api/upload", "/music/manage"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only run Supabase session middleware on auth-dependent routes
  const needsAuth = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Draft preview also needs auth
  const isPreview = pathname.startsWith("/post/") && request.nextUrl.searchParams.get("preview") === "true";

  if (needsAuth || isPreview) {
    return await updateSession(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
