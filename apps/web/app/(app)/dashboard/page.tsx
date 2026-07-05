'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getDemoCandidates, saveDemoCandidates, type DemoCandidate } from '@/lib/demo-state';

export default function DashboardPage() {
  const [candidates, setCandidates] = useState<DemoCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('Choose your candidate carefully. This choice cannot be changed later.');

  useEffect(() => {
    setCandidates(getDemoCandidates());
    if (typeof window !== 'undefined') {
      const storedSelection = window.localStorage.getItem('voter-demo-selection');
      if (storedSelection) setSelectedId(storedSelection);
    }
  }, []);

  const selectedCandidate = useMemo(() => candidates.find((c) => c.id === selectedId), [candidates, selectedId]);

  function voteFor(candidate: DemoCandidate) {
    const updated = candidates.map((item) => item.id === candidate.id ? { ...item, votes: item.votes + 1 } : item);
    setCandidates(updated);
    saveDemoCandidates(updated);
    setSelectedId(candidate.id);
    if (typeof window !== 'undefined') window.localStorage.setItem('voter-demo-selection', candidate.id);
    setMessage(`You voted for ${candidate.name}. This choice is locked for the demo.`);
  }

  return (
    <main className="container" style={{ padding: '48px 24px' }}>
      <span className="badge">Signed in</span>
      <h1 style={{ fontSize: '2rem', margin: '14px 0 8px' }}>Your ballot</h1>
      <p className="muted" style={{ maxWidth: '52ch' }}>
        Review the contest, select your candidate, and lock your vote. This demo does not allow edits after confirmation.
      </p>

      <div className="card" style={{ marginTop: 24, padding: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Contestants</h3>
        <p className="muted" style={{ marginBottom: 18 }}>{message}</p>
        <div style={{ display: 'grid', gap: 14 }}>
          {candidates.map((candidate) => {
            const isSelected = selectedId === candidate.id;
            return (
              <div key={candidate.id} className="card" style={{ padding: 18, border: isSelected ? '1px solid var(--brand)' : '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <div>
                    <h4 style={{ marginBottom: 4 }}>{candidate.name}</h4>
                    <p className="muted" style={{ fontSize: 14 }}>{candidate.party} • {candidate.description}</p>
                    <p className="faint" style={{ fontSize: 13, marginTop: 6 }}>Current support: {candidate.votes} votes</p>
                  </div>
                  <button className={`btn ${isSelected ? 'btn-ghost' : 'btn-primary'}`} type="button" onClick={() => voteFor(candidate)}>
                    {isSelected ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24, padding: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Your locked choice</h3>
        <p className="muted">{selectedCandidate ? `${selectedCandidate.name} (${selectedCandidate.party})` : 'No vote selected yet.'}</p>
        <Link href="/admin/console" className="btn btn-ghost" style={{ marginTop: 16 }}>
          Open admin console
        </Link>
      </div>
    </main>
  );
}
