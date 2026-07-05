'use client';

export type DemoUserStatus = 'active' | 'suspended' | 'blocked' | 'deleted';

export type DemoCandidate = {
  id: string;
  name: string;
  party: string;
  description: string;
  votes: number;
};

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  status: DemoUserStatus;
};

const CANDIDATES_KEY = 'voter-demo-candidates';
const USERS_KEY = 'voter-demo-users';

const defaultCandidates: DemoCandidate[] = [
  { id: '1', name: 'Ada Okafor', party: 'People First', description: 'Community-led policy', votes: 82 },
  { id: '2', name: 'Tunde Bello', party: 'Progressive Alliance', description: 'Education and jobs', votes: 64 },
  { id: '3', name: 'Mina Yusuf', party: 'Civic Future', description: 'Transparency and youth growth', votes: 41 },
];

const defaultUsers: DemoUser[] = [
  { id: 'u1', name: 'Amina Lawal', email: 'amina@example.com', status: 'active' },
  { id: 'u2', name: 'Seyi Danjuma', email: 'seyi@example.com', status: 'active' },
  { id: 'u3', name: 'Bola Okon', email: 'bola@example.com', status: 'suspended' },
];

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function ensureStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const existing = readStorage<T>(key, fallback);
  if (!existing || (Array.isArray(existing) && existing.length === 0)) {
    writeStorage(key, fallback);
    return fallback;
  }
  return existing;
}

export function getDemoCandidates(): DemoCandidate[] {
  return ensureStorage(CANDIDATES_KEY, defaultCandidates);
}

export function saveDemoCandidates(next: DemoCandidate[]) {
  writeStorage(CANDIDATES_KEY, next);
}

export function getDemoUsers(): DemoUser[] {
  return ensureStorage(USERS_KEY, defaultUsers);
}

export function saveDemoUsers(next: DemoUser[]) {
  writeStorage(USERS_KEY, next);
}
