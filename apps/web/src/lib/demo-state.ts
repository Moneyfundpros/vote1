'use client';

/* ============================================================
   Demo state for the National Digital Voting System flow.
   Everything is kept in localStorage so the whole journey —
   login → dashboard → ballot → confirmation → results → admin —
   is fully functional without a backend. No theme changes here;
   this file only holds data + helpers.
   ============================================================ */

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

export type VoteRecord = {
  candidateId: string;
  candidateName: string;
  party: string;
  voteId: string;
  at: string; // ISO timestamp
};

export type ActivityEntry = {
  id: string;
  label: string;
  detail: string;
  at: string; // ISO timestamp
};

export type VoterProfile = {
  name: string;
  voterId: string;
  verified: boolean;
  state: string;
  registeredOn: string;
};

/* Bumped to v2 so returning demo sessions pick up the new dataset. */
const CANDIDATES_KEY = 'voter-demo-candidates-v2';
const USERS_KEY = 'voter-demo-users-v2';
const VOTE_KEY = 'voter-demo-vote-v2';
const ACTIVITY_KEY = 'voter-demo-activity-v2';

/* Presidential contest — this one is live and reflects real demo votes. */
const defaultCandidates: DemoCandidate[] = [
  { id: '1', name: 'Ahmed Ibrahim', party: 'Unity Party', description: 'Jobs, security and national unity', votes: 8234562 },
  { id: '2', name: 'Grace Adewale', party: 'Progress Party', description: 'Education, health and reform', votes: 5795201 },
  { id: '3', name: 'Daniel Okoro', party: 'People First Party', description: 'Grassroots development', votes: 2764194 },
  { id: '4', name: 'Theophilus Musa', party: 'Visionary Party', description: 'Technology and youth growth', votes: 894882 },
  { id: 'none', name: 'None of the above', party: 'No preference', description: 'Decline to select a candidate', votes: 359879 },
];

/* Static supporting contests for the Results tabs. */
export const senateResults: DemoCandidate[] = [
  { id: 's1', name: 'Fatima Bello', party: 'Unity Party', description: 'Senate — Federal Capital Territory', votes: 742318 },
  { id: 's2', name: 'Chidi Nwankwo', party: 'Progress Party', description: 'Senate — Federal Capital Territory', votes: 689204 },
  { id: 's3', name: 'Aisha Mohammed', party: 'People First Party', description: 'Senate — Federal Capital Territory', votes: 421765 },
  { id: 's4', name: 'None of the above', party: 'No preference', description: 'Decline to select', votes: 51230 },
];

export const houseResults: DemoCandidate[] = [
  { id: 'h1', name: 'Emeka Obi', party: 'Progress Party', description: 'House of Rep. — District 3', votes: 312904 },
  { id: 'h2', name: 'Zainab Yusuf', party: 'Unity Party', description: 'House of Rep. — District 3', votes: 298117 },
  { id: 'h3', name: 'Samuel Eze', party: 'Visionary Party', description: 'House of Rep. — District 3', votes: 154880 },
  { id: 'h4', name: 'None of the above', party: 'No preference', description: 'Decline to select', votes: 22045 },
];

const defaultUsers: DemoUser[] = [
  { id: 'u1', name: 'Amina Lawal', email: 'amina@example.com', status: 'active' },
  { id: 'u2', name: 'Seyi Danjuma', email: 'seyi@example.com', status: 'active' },
  { id: 'u3', name: 'Bola Okon', email: 'bola@example.com', status: 'suspended' },
  { id: 'u4', name: 'John Doe', email: 'john.doe@example.com', status: 'active' },
];

export const voterProfile: VoterProfile = {
  name: 'John Doe',
  voterId: '1234 5678 9012',
  verified: true,
  state: 'Federal Capital Territory',
  registeredOn: '12 Jan 2024',
};

export const electionInfo = {
  title: '2024 General Election',
  electionDay: '25 May 2024',
  status: 'Ongoing',
  registeredVoters: 24567890,
  totalVotesCast: 18032219,
};

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
  const existing = readStorage<T | null>(key, null);
  if (existing === null || (Array.isArray(existing) && existing.length === 0)) {
    writeStorage(key, fallback);
    return fallback;
  }
  return existing;
}

/* ---------- Candidates ---------- */
export function getDemoCandidates(): DemoCandidate[] {
  return ensureStorage(CANDIDATES_KEY, defaultCandidates);
}

export function saveDemoCandidates(next: DemoCandidate[]) {
  writeStorage(CANDIDATES_KEY, next);
}

/* ---------- Users ---------- */
export function getDemoUsers(): DemoUser[] {
  return ensureStorage(USERS_KEY, defaultUsers);
}

export function saveDemoUsers(next: DemoUser[]) {
  writeStorage(USERS_KEY, next);
}

/* ---------- Voting ---------- */
export function getVoteRecord(): VoteRecord | null {
  return readStorage<VoteRecord | null>(VOTE_KEY, null);
}

export function hasVoted(): boolean {
  return getVoteRecord() !== null;
}

function randomVoteId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const block = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `VOTE-2024-${block(4)}-${block(4)}`;
}

/**
 * Records a vote in the demo: increments the candidate tally, stores a receipt,
 * and appends an activity log entry. Returns the created receipt.
 */
export function castVote(candidateId: string): VoteRecord | null {
  const candidates = getDemoCandidates();
  const candidate = candidates.find((c) => c.id === candidateId);
  if (!candidate) return null;

  const updated = candidates.map((c) =>
    c.id === candidateId ? { ...c, votes: c.votes + 1 } : c,
  );
  saveDemoCandidates(updated);

  const record: VoteRecord = {
    candidateId: candidate.id,
    candidateName: candidate.name,
    party: candidate.party,
    voteId: randomVoteId(),
    at: new Date().toISOString(),
  };
  writeStorage(VOTE_KEY, record);
  addActivity('Vote cast successfully', `Presidential ballot — receipt ${record.voteId}`);
  return record;
}

export function clearVoteRecord() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(VOTE_KEY);
}

/* ---------- Activity log ---------- */
const defaultActivity: ActivityEntry[] = [
  {
    id: 'a1',
    label: 'Identity verified',
    detail: 'NIN/BVN confirmed — one verified voter',
    at: '2024-05-20T09:12:00.000Z',
  },
  {
    id: 'a2',
    label: 'Signed in',
    detail: 'New device — Chrome on Windows',
    at: '2024-05-24T08:03:00.000Z',
  },
];

export function getActivity(): ActivityEntry[] {
  return ensureStorage(ACTIVITY_KEY, defaultActivity);
}

export function addActivity(label: string, detail: string) {
  const entry: ActivityEntry = {
    id: `a${Math.floor(Math.random() * 1_000_000)}`,
    label,
    detail,
    at: new Date().toISOString(),
  };
  const next = [entry, ...getActivity()].slice(0, 12);
  writeStorage(ACTIVITY_KEY, next);
}

/* ---------- Formatting helpers ---------- */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function totalVotes(candidates: DemoCandidate[]): number {
  return candidates.reduce((sum, c) => sum + c.votes, 0);
}
