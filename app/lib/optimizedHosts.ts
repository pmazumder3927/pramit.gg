// Mirrors next.config.js images.remotePatterns EXACTLY — only URLs that the
// optimizer will accept may be routed through next/image (anything else 400s
// at /_next/image, rendering a broken figure where a plain <img> worked).
// Keep in sync with next.config.js when adding hosts.
export function canOptimizeImage(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    const host = url.hostname;
    if (
      host === "img.youtube.com" ||
      host === "i.ytimg.com" ||
      host === "i.scdn.co" ||
      host === "mosaic.scdn.co"
    ) {
      return true;
    }
    // *.spotifycdn.com — wildcard requires an actual subdomain
    if (host.endsWith(".spotifycdn.com")) return true;
    // *.supabase.co is only allowlisted under the public storage path
    if (
      host.endsWith(".supabase.co") &&
      url.pathname.startsWith("/storage/v1/object/public/")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
