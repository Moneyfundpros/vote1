import Link from 'next/link';

export default function PollsPage() {
  return (
    <main className="container" style={{ padding: '48px 24px' }}>
      <span className="badge">Demo polls</span>
      <h1 style={{ fontSize: '2rem', margin: '14px 0 8px' }}>Open poll feed</h1>
      <p className="muted" style={{ maxWidth: '56ch' }}>
        Browse live demo issues and jump into the voting flow from here.
      </p>
      <div className="card" style={{ marginTop: 24, padding: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Public issues</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {[
            ['School safety', 'Community survey', '83% support'],
            ['Transit reform', 'City policy', '71% support'],
            ['Digital civic access', 'National issue', '67% support'],
          ].map(([title, blurb, score]) => (
            <div key={title} className="card" style={{ padding: 16 }}>
              <strong>{title}</strong>
              <p className="muted" style={{ marginTop: 4 }}>{blurb}</p>
              <p className="faint" style={{ marginTop: 6 }}>{score}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <Link href="/dashboard" className="btn btn-primary">
          Go to ballot
        </Link>
      </div>
    </main>
  );
}
