/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Turbopack configuration (required for Next.js 16)
  turbopack: {},

  // Performance optimizations
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [], // Add your image domains here
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Enable gzip compression
  compress: true,

  // Performance budgets (development warnings)
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },

  // Performance monitoring
  generateBuildId: async () => {
    // Use git commit hash for better cache invalidation
    const { execSync } = require("child_process");
    try {
      const commitHash = execSync("git rev-parse HEAD").toString().trim();
      return commitHash.substring(0, 8);
    } catch {
      return null; // Fallback to default
    }
  },

  // Headers for better caching and security
  headers: async () => [
    {
      source: "/_next/static/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/favicon.ico",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=86400",
        },
      ],
    },
  ],

  // Redirects for better SEO and UX
  redirects: async () => [
    {
      source: "/packaging/:id/edit",
      destination: "/packaging/:id",
      permanent: true,
    },
  ],
};

module.exports = nextConfig;
