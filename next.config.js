/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Rentals was replaced by the Kijiji-style classifieds section.
      { source: "/fishmb/rentals", destination: "/fishmb/classifieds", permanent: true },
      { source: "/fishmb/rentals/:path*", destination: "/fishmb/classifieds", permanent: true },
    ];
  },
  experimental: {
    // better-sqlite3 ships a native binding that webpack can't bundle —
    // load it (and the Prisma adapter) externally at runtime instead.
    serverComponentsExternalPackages: [
      "better-sqlite3",
      "@prisma/adapter-better-sqlite3",
      "@prisma/client",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "**.myshopify.com" },
      { protocol: "https", hostname: "ae-pic-a1.aliexpress-media.com" },
    ],
  },
};

module.exports = nextConfig;
