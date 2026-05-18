/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'itin-dev.wanderlogstatic.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: 'api.rishtenate.org' },
      { protocol: 'https', hostname: '*.vercel.app' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  },
  // Don't fail the Vercel production build on ESLint warnings.
  // Lint is still enforced in `pnpm run lint` and CI.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
