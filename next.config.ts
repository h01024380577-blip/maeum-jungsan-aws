import type { NextConfig } from 'next';

const isCSR = process.env.NEXT_BUILD_CSR === '1';

const nextConfig: NextConfig = {
  distDir: isCSR ? 'dist/web' : 'dist',
  ...(isCSR ? { output: 'export' } : {}),
  images: {
    ...(isCSR ? { unoptimized: true } : {}),
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
};

export default nextConfig;
