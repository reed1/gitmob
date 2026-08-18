import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '.loc',
    '.local.r-mulyadi.com',
    '.zerotail.r-mulyadi.com',
    '.wifi.r-mulyadi.com',
  ],
  // Three servers can be up at once, so each names its own build directory: `.next-prod` for the
  // deployed one (run_production.sh), `.next-dev` for the one `rv run` owns (`pnpm dev:rv`), and
  // this default for `pnpm dev`. Turbopack locks its dist dir, so sharing one blocks the second.
  distDir: process.env.GITMOB_DIST_DIR ?? '.next',
};

export default nextConfig;
