import { AdminRepoDrizzle } from '@voter/core';
import { getWriteDb } from './db';

let _repo: AdminRepoDrizzle | undefined;
export function adminRepo(): AdminRepoDrizzle {
  if (!_repo) _repo = new AdminRepoDrizzle(getWriteDb());
  return _repo;
}
