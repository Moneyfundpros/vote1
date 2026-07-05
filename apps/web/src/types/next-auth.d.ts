import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      kycStatus: string;
      canVote: boolean;
    } & DefaultSession['user'];
  }
  interface User {
    role?: string;
    kycStatus?: string;
  }
}
