import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '.loc',
    '.local.r-mulyadi.com',
    '.zerotail.r-mulyadi.com',
    '.wifi.r-mulyadi.com',
  ],
  distDir: process.env.GITMOB_PROD ? '.next-prod' : '.next',
};

export default nextConfig;
