import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['http://10.13.13.*'],
  distDir: process.env.GITMOB_PROD ? '.next-prod' : '.next',
};

export default nextConfig;
