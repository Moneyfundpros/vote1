'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { getVoteRecord, voterProfile, type VoteRecord } from '@/lib/demo-state';

export default function StatusPage() {
  const [vote, setVote] = useState<VoteRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setVote(getVoteRecord());
    setReady(true);
  }, []);

  const rows: [string, string][] = [
    ['Full name', voterProfile.name],
    ['Voter ID', voterProfile.voterId],
    ['State', voterProfile.state],
    ['Registered on', voterProfile.registeredOn],
    ['Identity verification', voterProfile.verified ? 'Verified (NIN/BVN)' : 'Pending'],
  ];

  return (
    <main className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link href="/dashboard" className="icon-btn" aria-label="Back">
          <Icon name="chevronLeft" size={18} />
        </Link>
        <h1 style={{ fontSize: '1.5rem' }}>Voter Status</h1>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 18 }}>
        <div className="eligible">
          <span className="shield">
            <Icon name="check" size={22} strokeWidth={3} />
          </span>
          <div>
            <h3>Registration active</h3>
            <p className="muted" style={{ fontSize: 14 }}>You are registered and eligible to vote.</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 18 }}>
        <h3 style={{ marginBottom: 14 }}>Registration details</h3>
        {rows.map(([k, v]) => (
          <div key={k} className="sys-row">
            <span className="muted">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ marginBottom: 10 }}>Ballot status</h3>
        {ready && vote ? (
          <p className="muted" style={{ fontSize: 14 }}>
            You voted for <strong style={{ color: 'var(--ink)' }}>{vote.candidateName}</strong>. Receipt {vote.voteId}.
          </p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>You have not cast your ballot yet.</p>
            <Link href="/vote" className="btn btn-primary">Cast your vote</Link>
          </>
        )}
      </div>
    </main>
  );
}
