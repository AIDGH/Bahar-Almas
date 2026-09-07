import type { NextConfig } from 'next';

const internalApiBaseUrl = (
  process.env.API_BASE_URL ?? 'http://localhost:4002/api/v1'
).replace(/\/$/, '');

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    '10.184.100.185',
    '10.215.216.104',
    '192.168.100.7',
    '172.20.159.124'
  ],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${internalApiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
