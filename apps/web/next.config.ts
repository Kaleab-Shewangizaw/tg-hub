import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@emberly/core', '@emberly/telegram'],
  experimental: {
    // Telegram Desktop exports (JSON, without media) can be several MB.
    serverActions: { bodySizeLimit: '20mb' },
  },
};

export default nextConfig;
