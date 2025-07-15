/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "img.youtube.com",
      "i.ytimg.com",
      "i.scdn.co",
      "mosaic.scdn.co",
      "image-cdn-ak.spotifycdn.com",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // SEO optimizations
  trailingSlash: false,
  generateEtags: true,
  poweredByHeader: false,
  compress: true,
};

module.exports = nextConfig;
