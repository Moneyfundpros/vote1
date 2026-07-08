'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { electionInfo, formatNumber } from '@/lib/demo-state';

export default function ElectionInfoPage() {
  const details: [string, string][] = [
    ['Election', electionInfo.title],
    ['Status', electionInfo.status],
    ['Election Day', electionInfo.electionDay],
    ['Registered voters', formatNumber(electionInfo.registeredVoters)],
    ['Contests', 'Presidential · Senate · House of Rep.'],
  ];

  const guidelines = [
    'Bring your Voter ID and a valid means of identification.',
    'Each verified voter may cast one ballot per contest.',
    'Your vote is anonymous and end-to-end encrypted.',
    'Once submitted, a vote cannot be changed.',
    'Results are published live and are tamper-evident.',
  ];

  return (
    <main className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link href="/dashboard" className="icon-btn" aria-label="Back">
          <Icon name="chevronLeft" size={18} />
        </Link>
        <h1 style={{ fontSize: '1.5rem' }}>Election Information</h1>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 18 }}>
        <h3 style={{ marginBottom: 14 }}>Details</h3>
        {details.map(([k, v]) => (
          <div key={k} className="sys-row">
            <span className="muted">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 18 }}>
        <h3 style={{ marginBottom: 14 }}>Voting guidelines</h3>
        <ul className="stack" style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-soft)', fontSize: 15 }}>
          {guidelines.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/vote" className="btn btn-primary">Cast your vote</Link>
        <Link href="/results" className="btn btn-ghost">View results</Link>
      </div>
    </main>
  );
}
