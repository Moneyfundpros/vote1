import { AppError } from '@voter/core';
import { auth } from './auth';

export interface Principal {
  id: string;
  role: string;
  kycStatus: string;
}

/** Require an authenticated session. Throws AppError(UNAUTHENTICATED) otherwise. */
export async function requireSession(): Promise<Principal> {
  const session = await auth();
  if (!session?.user?.id) throw new AppError('UNAUTHENTICATED', 'Sign in required');
  return { id: session.user.id, role: session.user.role, kycStatus: session.user.kycStatus };
}

/** Require one of the given roles. Throws AppError(FORBIDDEN) otherwise. */
export async function requireRole(...roles: string[]): Promise<Principal> {
  const p = await requireSession();
  if (!roles.includes(p.role)) throw new AppError('FORBIDDEN', 'Insufficient permissions');
  return p;
}
