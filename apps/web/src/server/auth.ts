import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';

/**
 * Auth.js (NextAuth) self-hosted config. Phone-OTP is the primary credential (Nigeria phone-first);
 * the OTP challenge itself lives in Redis with a TTL (issued/verified via /api/auth/login/*).
 * The session carries `role`, `kycStatus`, and a derived `canVote` so the UI can gate without a
 * round-trip — but every mutation re-checks server-side.
 *
 * NOTE: wire the Drizzle adapter (@auth/drizzle-adapter against @voter/db) + a Credentials provider
 * that validates the verified OTP challenge. Kept minimal here to establish the surface.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: 'database' },
  pages: { signIn: '/login' },
  callbacks: {
    session({ session, user }) {
      if (session.user && user) {
        // Extend the session shape; fields populated by the adapter/user row.
        (session.user as { role?: string }).role = (user as { role?: string }).role ?? 'voter';
        (session.user as { kycStatus?: string }).kycStatus =
          (user as { kycStatus?: string }).kycStatus ?? 'unverified';
        (session.user as { canVote?: boolean }).canVote =
          ((user as { kycStatus?: string }).kycStatus ?? 'unverified') === 'verified';
      }
      return session;
    },
  },
  providers: [
    // TODO: Credentials provider for phone-OTP (challenge verified in /api/auth/login/verify-otp),
    // plus optional Email provider (Resend magic link). See docs/SETUP.md.
  ],
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
