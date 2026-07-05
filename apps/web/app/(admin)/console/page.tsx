'use client';

import { useEffect, useMemo, useState } from 'react';
import { getDemoCandidates, getDemoUsers, saveDemoCandidates, saveDemoUsers, type DemoCandidate, type DemoUser } from '@/lib/demo-state';

export default function ConsolePage() {
  const [candidates, setCandidates] = useState<DemoCandidate[]>([]);
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [name, setName] = useState('');
  const [party, setParty] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setCandidates(getDemoCandidates());
    setUsers(getDemoUsers());
  }, []);

  const chartData = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
    return sorted;
  }, [candidates]);

  function addCandidate() {
    if (!name.trim() || !party.trim()) return;
    const next = [...candidates, { id: crypto.randomUUID(), name: name.trim(), party: party.trim(), description: description.trim() || 'New contestant', votes: 0 }];
    setCandidates(next);
    saveDemoCandidates(next);
    setName('');
    setParty('');
    setDescription('');
  }

  function updateUserStatus(userId: string, status: DemoUser['status']) {
    const next = users.map((user) => (user.id === userId ? { ...user, status } : user));
    setUsers(next);
    saveDemoUsers(next);
  }

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem', display: 'grid', gap: 24 }}>
      <section className="card">
        <h1 style={{ marginBottom: 8 }}>Admin console</h1>
        <p className="muted">Manage contestants, review users, and monitor the demo vote split.</p>
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 12 }}>Add contestant</h3>
        <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Party" value={party} onChange={(e) => setParty(e.target.value)} />
          <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="btn btn-primary" style={{ width: 180 }} type="button" onClick={addCandidate}>
            Add contestant
          </button>
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 12 }}>Contestants</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {candidates.map((candidate) => (
            <div key={candidate.id} className="card" style={{ padding: 16 }}>
              <strong>{candidate.name}</strong>
              <p className="muted" style={{ marginTop: 4 }}>{candidate.party} • {candidate.description}</p>
              <p className="faint" style={{ marginTop: 6 }}>Votes: {candidate.votes}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 12 }}>Users</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {users.map((user) => (
            <div key={user.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong>{user.name}</strong>
                <p className="muted" style={{ marginTop: 4 }}>{user.email}</p>
                <p className="faint" style={{ marginTop: 4, textTransform: 'capitalize' }}>Status: {user.status}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" type="button" onClick={() => updateUserStatus(user.id, 'active')}>Activate</button>
                <button className="btn btn-ghost" type="button" onClick={() => updateUserStatus(user.id, 'suspended')}>Suspend</button>
                <button className="btn btn-ghost" type="button" onClick={() => updateUserStatus(user.id, 'blocked')}>Block</button>
                <button className="btn btn-ghost" type="button" onClick={() => updateUserStatus(user.id, 'deleted')}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 12 }}>Vote chart</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {chartData.map((candidate) => (
            <div key={candidate.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>{candidate.name}</span>
                <span>{candidate.votes}</span>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ height: '100%', width: `${Math.max(8, (candidate.votes / Math.max(...chartData.map((item) => item.votes), 1)) * 100)}%`, background: 'linear-gradient(90deg, var(--brand), rgba(255,255,255,0.5))', borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
