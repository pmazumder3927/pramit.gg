/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['img.youtube.com', 'i.ytimg.com', 'i.scdn.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Enable better SEO
  trailingSlash: true,
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js'],
  },
}

module.exports = nextConfig 