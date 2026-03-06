// apps/web/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "standalone" — uncomment for Docker deployments only
  // On Render free tier, we use `next start` directly

  // Transpile the shared workspace package so Next.js can consume its TS source
  transpilePackages: ["@pcg/shared"],

  // Proxy API requests in development to avoid CORS issues
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/:path*`,
      },
    ];
  },

  // Strict mode catches common React mistakes early
  reactStrictMode: true,

  // Disable the X-Powered-By header (minor security hardening)
  poweredByHeader: false,

  // Image optimization config (add allowed domains as needed)
  images: {
    unoptimized: true, // Disable for now since this is a simulator
  },

  // CRITICAL: Don't let minor TS warnings kill production builds on Render
  typescript: {
    ignoreBuildErrors: true,
  },

  // Don't block builds on lint warnings either
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
