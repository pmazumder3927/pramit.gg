import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // List of bot user agents to skip middleware for
  const botUserAgents = [
    'googlebot',
    'bingbot',
    'slurp',
    'duckduckbot',
    'baiduspider',
    'yandexbot',
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'whatsapp',
    'applebot',
    'semrushbot',
    'ahrefsbot',
    'lighthouse',
    'pagespeed',
  ];
  
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  const isBot = botUserAgents.some(bot => userAgent.includes(bot));
  
  // Skip middleware for bots and certain paths
  if (isBot || 
      request.nextUrl.pathname === '/robots.txt' || 
      request.nextUrl.pathname === '/sitemap.xml' ||
      request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt
     * - sitemap.xml
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
