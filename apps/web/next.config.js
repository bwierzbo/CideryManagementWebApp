/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Performance optimizations
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
  },

  // Bundle optimization
  webpack: (config, { dev, isServer }) => {
    // Enable SWC minification for better performance
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            // Separate vendor chunks for better caching
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendors",
              chunks: "all",
              enforce: true,
            },
            // Create separate chunks for large libraries
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: "react",
              chunks: "all",
              enforce: true,
            },
            // UI library chunk
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|@headlessui|framer-motion)[\\/]/,
              name: "ui-libs",
              chunks: "all",
              enforce: true,
            },
            // Chart/visualization libraries
            charts: {
              test: /[\\/]node_modules[\\/](recharts|d3|chart\.js)[\\/]/,
              name: "charts",
              chunks: "all",
              enforce: true,
            },
            // PDF and export libraries
            pdf: {
              test: /[\\/]node_modules[\\/](@react-pdf|jspdf|html2canvas)[\\/]/,
              name: "pdf-libs",
              chunks: "all",
              enforce: true,
            },
            // Utility libraries
            utils: {
              test: /[\\/]node_modules[\\/](lodash|date-fns|clsx|class-variance-authority)[\\/]/,
              name: "utils",
              chunks: "all",
              enforce: true,
            },
            // Common application code
            common: {
              name: "common",
              minChunks: 2,
              chunks: "all",
              enforce: true,
            },
          },
        },
      };

      // Tree shaking for better bundle size
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    // Optimize images
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|svg)$/,
      use: {
        loader: "file-loader",
        options: {
          publicPath: "/_next/static/images/",
          outputPath: "static/images/",
        },
      },
    });

    return config;
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

  // Generate bundle analyzer in production
  ...(process.env.ANALYZE === "true" && {
    webpack: (config, { dev, isServer }) => {
      if (!dev && !isServer) {
        const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: "static",
            reportFilename: "../bundle-analysis.html",
            openAnalyzer: false,
          }),
        );
      }
      return config;
    },
  }),

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
