import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only the dev:test and start:test scripts set NEXT_DIST_DIR (to .next-test, built with the
  // test project's values); every other build, including Vercel's, uses .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Lets dev:test be opened through a Cloudflare quick tunnel. Dev server only.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
