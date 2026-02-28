// apps/web/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker production builds — generates a self-contained
  // server.js in .next/standalone that includes all dependencies.
  output: "standalone",

  // Transpile the shared workspace package so Next.js can consume its TS source
  transpilePackages: ["@pcg/shared"],

  // Proxy API requests in development to avoid CORS issues
  async rewrites() {
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
};

module.exports = nextConfig;
