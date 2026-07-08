'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icons';
import { electionInfo, getVoteRecord, voterProfile, type VoteRecord } from '@/lib/demo-state';

export default function ConfirmationPage() {
  const router = useRouter();
  const [vote, setVote] = useState<VoteRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const record = getVoteRecord();
    if (!record) {
      router.replace('/vote');
      return;
    }
    setVote(record);
    setReady(true);
  }, [router]);

  function copyId() {
    if (!vote) return;
    navigator.clipboard?.writeText(vote.voteId).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => undefined,
    );
  }

  function downloadReceipt() {
    if (!vote) return;
    const lines = [
      'NATIONAL DIGITAL VOTING SYSTEM',
      'Secure · Transparent · Trusted',
      '----------------------------------------',
      'VOTE RECEIPT',
      '',
      `Election:     ${electionInfo.title}`,
      `Contest:      Presidential`,
      `Voter:        ${voterProfile.name}`,
      `Voter ID:     ${voterProfile.voterId}`,
      `Candidate:    ${vote.candidateName} (${vote.party})`,
      `Vote ID:      ${vote.voteId}`,
      `Timestamp:    ${new Date(vote.at).toLocaleString()}`,
      '',
      'This receipt confirms your vote was recorded securely.',
      'Use the Vote ID above to verify your vote later.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote-receipt-${vote.voteId}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!ready || !vote) return null;

  return (
    <main className="screen">
      <div className="card center" style={{ padding: '38px 28px' }}>
        <span className="confirm-check">
          <Icon name="check" size={44} strokeWidth={3} />
        </span>
        <h2 style={{ fontSize: '1.6rem', marginBottom: 8 }}>Vote Submitted Successfully!</h2>
        <p className="muted" style={{ marginBottom: 24, maxWidth: '42ch', marginInline: 'auto' }}>
          Your vote has been recorded securely. Thank you for participating in the {electionInfo.title}.
        </p>

        <p className="faint" style={{ fontSize: 13, marginBottom: 8, textAlign: 'left' }}>Your Vote ID</p>
        <div className="voteid-box" style={{ marginBottom: 8 }}>
          <span>{vote.voteId}</span>
          <button type="button" onClick={copyId}>
            <Icon name="copy" size={16} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="faint center" style={{ fontSize: 13, marginBottom: 26 }}>
          You can use this ID to verify your vote in the future.
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          <Link href="/dashboard" className="btn btn-primary btn-lg btn-block">
            Go to Dashboard
          </Link>
          <button type="button" className="btn btn-ghost btn-block" onClick={downloadReceipt}>
            <Icon name="download" size={16} /> Download Receipt
          </button>
          <Link href="/results" className="btn-link" style={{ marginTop: 6 }}>
            View live results →
          </Link>
        </div>
      </div>
    </main>
  );
}
