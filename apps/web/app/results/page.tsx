'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icons';
import {
  formatNumber,
  getDemoCandidates,
  houseResults,
  senateResults,
  totalVotes,
  type DemoCandidate,
} from '@/lib/demo-state';

const TABS = ['Presidential', 'Senate', 'House of Rep.'] as const;
type Tab = (typeof TABS)[number];

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function ResultsPage() {
  const [tab, setTab] = useState<Tab>('Presidential');
  const [presidential, setPresidential] = useState<DemoCandidate[]>([]);

  useEffect(() => {
    setPresidential(getDemoCandidates());
  }, []);

  const rows = useMemo(() => {
    const set =
      tab === 'Presidential' ? presidential : tab === 'Senate' ? senateResults : houseResults;
    return [...set].sort((a, b) => b.votes - a.votes);
  }, [tab, presidential]);

  const total = totalVotes(rows);

  return (
    <main className="container screen-wide" style={{ padding: '40px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/dashboard" className="icon-btn" aria-label="Back">
          <Icon name="chevronLeft" size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.7rem' }}>Election Results</h1>
          <p className="muted" style={{ fontSize: 14 }}>2024 General Election</p>
        </div>
      </div>

      <div className="tabs" style={{ marginTop: 18 }}>
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <p className="faint" style={{ fontSize: 13 }}>
          Results as of {new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <span className="live-dot">
          <i /> Live
        </span>
      </div>

      <div className="card" style={{ padding: 24 }}>
        {rows.map((c, i) => {
          const pct = total ? (c.votes / total) * 100 : 0;
          return (
            <div key={c.id} className="result-row">
              <span className="ballot-avatar" style={{ width: 42, height: 42 }}>
                {c.id.startsWith('h4') || c.id === 'none' || c.id === 's4' ? '—' : initials(c.name)}
              </span>
              <div className="result-body">
                <div className="result-top">
                  <div>
                    <strong>{c.name}</strong>
                    <span className="muted" style={{ display: 'block', fontSize: 13 }}>
                      {c.party}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="pct">{pct.toFixed(2)}%</span>
                    <span className="faint" style={{ display: 'block', fontSize: 12 }}>
                      {formatNumber(c.votes)} votes
                    </span>
                  </div>
                </div>
                <div className="result-track">
                  <div className="result-fill" style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
              </div>
              {i === 0 && (
                <span className="pill-verified" style={{ alignSelf: 'flex-start' }}>
                  Leading
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="secure-note" style={{ marginTop: 18 }}>
        <span className="ic">
          <Icon name="shield" size={18} />
        </span>
        <span>Results are transmitted securely and cannot be altered.</span>
      </div>
      <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>
        Total Votes Cast: <strong style={{ color: 'var(--ink)' }}>{formatNumber(total)}</strong>
      </p>
    </main>
  );
}
