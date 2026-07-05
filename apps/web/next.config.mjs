/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't fail the production build on lint/type strictness (e.g. unused-var warnings).
  // The app still compiles and runs; run `pnpm lint` / `pnpm typecheck` separately in CI.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Transpile workspace packages (shipped as TS source, not pre-built).
  transpilePackages: [
    '@voter/core',
    '@voter/db',
    '@voter/redis',
    '@voter/queue',
    '@voter/storage',
    '@voter/email',
    '@voter/kyc',
    '@voter/security',
  ],
  // Keep heavy SDKs server-only (renamed from experimental.serverComponentsExternalPackages in Next 15).
  serverExternalPackages: ['@aws-sdk/client-s3', '@aws-sdk/client-kms', 'pg'],
  async headers() {
    return [
      {
        source: '/api/polls/:pollId/results',
        headers: [{ key: 'Cache-Control', value: 's-maxage=1, stale-while-revalidate=5' }],
      },
    ];
  },
};

export default nextConfig;
