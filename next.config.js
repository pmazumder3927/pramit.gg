/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,

  // Optimize images
  images: {
    // Use remotePatterns instead of deprecated domains
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.spotifycdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mosaic.scdn.co",
        pathname: "/**",
      },
    ],
    // Optimize image formats
    formats: ["image/avif", "image/webp"],
    // Reduce image sizes for faster loading
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Enable experimental features for better performance
  experimental: {
    // Optimize package imports for smaller bundles
    optimizePackageImports: [
      "motion",
      "date-fns",
      "react-markdown",
      "swr",
      "rehype-katex",
      "rehype-highlight",
      "rehype-raw",
      "remark-gfm",
      "remark-math",
    ],
  },

  // Compress responses
  compress: true,

  // Generate ETags for caching
  generateEtags: true,

  // Old URLs still indexed by search engines from previous site versions
  async redirects() {
    return [
      {
        source: "/about",
        destination: "/connect",
        permanent: true,
      },
    ];
  },

  // Power headers for security and caching
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            // Vercel's default HSTS lacks includeSubDomains/preload; with them
            // (and an hstspreload.org submission) browsers skip the http:// hop
            // when someone types the bare domain. All *.pramit.gg subdomains
            // are Vercel-aliased and already HTTPS.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/(.*)\\.(ico|png|jpg|jpeg|gif|webp|svg|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Post-embedded playground iframes (static HTML in public/) — let the
        // edge serve them instead of hitting the origin per iframe per reader.
        source: "/playgrounds/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // Self-hosted third-party assets: KaTeX lives under a version-pathed
        // dir (bump the path on upgrade) and the font woff2s are frozen
        // upstream files — both safe to mark immutable.
        source: "/vendor/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
