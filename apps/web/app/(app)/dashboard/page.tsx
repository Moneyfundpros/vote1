'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icons';
import {
  electionInfo,
  getVoteRecord,
  voterProfile,
  type VoteRecord,
} from '@/lib/demo-state';

const TILES = [
  {
    href: '/vote',
    icon: 'ballot' as const,
    title: 'Cast Your Vote',
    blurb: 'Vote for your preferred candidate',
  },
  {
    href: '/status',
    icon: 'clipboard' as const,
    title: 'Check Status',
    blurb: 'Check your voter registration status',
  },
  {
    href: '/election-info',
    icon: 'info' as const,
    title: 'Election Info',
    blurb: 'View election details, guidelines and more',
  },
  {
    href: '/activity',
    icon: 'activity' as const,
    title: 'My Activity',
    blurb: 'View your voting activity and logs',
  },
];

export default function DashboardPage() {
  const [vote, setVote] = useState<VoteRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setVote(getVoteRecord());
    setReady(true);
  }, []);

  return (
    <main className="screen">
      {/* Greeting */}
      <div className="greet">
        <div>
          <div className="who">
            <h1>Hello, {voterProfile.name}</h1>
            {voterProfile.verified && (
              <span className="pill-verified">
                <Icon name="check" size={13} strokeWidth={3} /> Verified
              </span>
            )}
          </div>
          <p className="voter-id">Voter ID: {voterProfile.voterId}</p>
        </div>
        <Link href="/activity" className="icon-btn" aria-label="Notifications">
          <Icon name="bell" size={18} />
        </Link>
      </div>

      {/* Eligibility / vote status */}
      {ready && vote ? (
        <div className="card" style={{ marginTop: 22, padding: 22 }}>
          <div className="eligible">
            <span className="shield">
              <Icon name="check" size={22} strokeWidth={3} />
            </span>
            <div style={{ flex: 1 }}>
              <h3>Your vote has been recorded</h3>
              <p className="muted" style={{ fontSize: 14 }}>
                You voted for <strong style={{ color: 'var(--ink)' }}>{vote.candidateName}</strong>{' '}
                ({vote.party}).
              </p>
              <p className="faint" style={{ fontSize: 13, marginTop: 6 }}>Receipt: {vote.voteId}</p>
              <Link href="/results" className="btn btn-primary" style={{ marginTop: 14 }}>
                View live results
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 22, padding: 22 }}>
          <div className="eligible">
            <span className="shield">
              <Icon name="shield" size={22} />
            </span>
            <div>
              <h3>You are eligible to vote</h3>
              <p className="muted" style={{ fontSize: 14 }}>Election: {electionInfo.title}</p>
              <p className="muted" style={{ fontSize: 14 }}>Election Day: {electionInfo.electionDay}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <h3 style={{ margin: '30px 0 14px', fontSize: '1.1rem' }}>What would you like to do?</h3>
      <div className="tiles">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="tile">
            <span className="tile-ic">
              <Icon name={tile.icon} size={22} />
            </span>
            <h4>{tile.title}</h4>
            <p>{tile.blurb}</p>
          </Link>
        ))}
      </div>

      {/* Secure footer */}
      <div className="secure-note" style={{ marginTop: 22 }}>
        <span className="ic">
          <Icon name="lock" size={18} />
        </span>
        <span>
          <strong style={{ color: 'var(--ink)' }}>Your vote is secure and confidential.</strong>{' '}
          Powered by end-to-end encryption.
        </span>
      </div>
    </main>
  );
}
