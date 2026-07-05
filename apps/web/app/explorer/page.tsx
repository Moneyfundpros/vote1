import Link from 'next/link';

export default function ExplorerPage() {
  return (
    <main className="container" style={{ padding: '48px 24px' }}>
      <span className="badge">Transparency</span>
      <h1 style={{ fontSize: '2rem', margin: '14px 0 8px' }}>Live audit view</h1>
      <p className="muted" style={{ maxWidth: '56ch' }}>
        Follow the demo vote totals and see how the public results are being tracked.
      </p>
      <div className="card" style={{ marginTop: 24, padding: 24 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {[
            ['Ada Okafor', '82'],
            ['Tunde Bello', '64'],
            ['Mina Yusuf', '41'],
          ].map(([name, votes]) => (
            <div key={name} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between' }}>
              <strong>{name}</strong>
              <span className="faint">{votes} votes</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <Link href="/dashboard" className="btn btn-primary">
          Open voting flow
        </Link>
      </div>
    </main>
  );
}
