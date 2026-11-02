import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // The PBA feeds are large JSON documents; keep them out of client bundles.
    serverSourceMaps: false,
  },
};

export default nextConfig;
