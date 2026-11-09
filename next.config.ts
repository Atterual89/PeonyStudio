import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.tickettailor.com",
      },
      {
        protocol: "https",
        hostname: "uploads.tickettailorassets.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudfront.net",
      },
    ],
  },
};

export default nextConfig;
