import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next-local",
  images: { unoptimized: true },
};

export default nextConfig;
