'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icons';
import {
  castVote,
  getDemoCandidates,
  getVoteRecord,
  type DemoCandidate,
} from '@/lib/demo-state';

const STEPS = ['Instructions', 'Ballot', 'Review', 'Confirm'];

function Stepper({ current }: { current: number }) {
  return (
    <div className="stepper">
      {STEPS.map((label, i) => (
        <div key={label} style={{ display: 'contents' }}>
          {i > 0 && <div className={`step-line ${i <= current ? 'done' : ''}`} />}
          <div className={`step ${i === current ? 'active' : i < current ? 'done' : ''}`}>
            <span className="dot">
              {i < current ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}
            </span>
            <small>{label}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function VotePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [candidates, setCandidates] = useState<DemoCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCandidates(getDemoCandidates());
    setAlreadyVoted(getVoteRecord() !== null);
  }, []);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  function submit() {
    if (!selectedId) return;
    setSubmitting(true);
    const record = castVote(selectedId);
    if (record) {
      router.push('/vote/confirmation');
    } else {
      setSubmitting(false);
    }
  }

  if (alreadyVoted) {
    return (
      <main className="screen">
        <div className="card center" style={{ padding: 32 }}>
          <span className="confirm-check" style={{ width: 68, height: 68 }}>
            <Icon name="check" size={30} strokeWidth={3} />
          </span>
          <h2 style={{ marginBottom: 8 }}>You have already voted</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            Each verified voter can cast one ballot. Your vote has been securely recorded.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/results" className="btn btn-primary">View results</Link>
            <Link href="/dashboard" className="btn btn-ghost">Back to dashboard</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link href="/dashboard" className="icon-btn" aria-label="Back">
          <Icon name="chevronLeft" size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.4rem' }}>Cast Your Vote</h1>
          <p className="muted" style={{ fontSize: 14 }}>2024 General Election · Presidential</p>
        </div>
      </div>

      <Stepper current={step} />

      {/* Step 1 — Instructions */}
      {step === 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 12 }}>Before you vote</h3>
          <ul className="stack" style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-soft)', fontSize: 15 }}>
            <li>Select <strong style={{ color: 'var(--ink)' }}>one</strong> candidate for the Presidential contest.</li>
            <li>You can review your choice before submitting.</li>
            <li>Once submitted, your vote is <strong style={{ color: 'var(--ink)' }}>final</strong> and cannot be changed.</li>
            <li>Your ballot is anonymous and end-to-end encrypted.</li>
          </ul>
          <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 22 }} onClick={() => setStep(1)}>
            Continue
          </button>
        </div>
      )}

      {/* Step 2 — Ballot */}
      {step === 1 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 4 }}>Select your preferred candidate</h3>
          <p className="muted" style={{ marginBottom: 18, fontSize: 14 }}>for President</p>
          <div className="ballot-list">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`ballot-option ${selectedId === c.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="ballot-avatar">
                  {c.id === 'none' ? '—' : initials(c.name)}
                </span>
                <span className="ballot-body">
                  <strong>{c.name}</strong>
                  <span>{c.party}</span>
                </span>
                <span className="ballot-radio">
                  <i />
                </span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={!selectedId}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 2 && selected && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 4 }}>Review your choice</h3>
          <p className="muted" style={{ marginBottom: 18, fontSize: 14 }}>
            Please confirm before submitting. This cannot be changed.
          </p>
          <div className="ballot-option selected" style={{ cursor: 'default' }}>
            <span className="ballot-avatar">
              {selected.id === 'none' ? '—' : initials(selected.name)}
            </span>
            <span className="ballot-body">
              <strong>{selected.name}</strong>
              <span>{selected.party}</span>
            </span>
            <Icon name="check" size={20} strokeWidth={3} style={{ color: 'var(--brand)' }} />
          </div>
          <div className="secure-note" style={{ marginTop: 18 }}>
            <span className="ic"><Icon name="lock" size={18} /></span>
            <span>Your vote will be encrypted and recorded anonymously.</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={submitting}>
              Change
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Vote'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
