import Link from 'next/link';

export default function CandidatesPage() {
  return (
    <main className="container" style={{ padding: '48px 24px' }}>
      <span className="badge">Demo candidates</span>
      <h1 style={{ fontSize: '2rem', margin: '14px 0 8px' }}>Contesting profiles</h1>
      <p className="muted" style={{ maxWidth: '56ch' }}>
        Review the available profiles and jump into the live demo ballot.
      </p>
      <div className="card" style={{ marginTop: 24, padding: 24 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {[
            ['Ahmed Ibrahim', 'Unity Party', 'Jobs, security and national unity'],
            ['Grace Adewale', 'Progress Party', 'Education, health and reform'],
            ['Daniel Okoro', 'People First Party', 'Grassroots development'],
            ['Theophilus Musa', 'Visionary Party', 'Technology and youth growth'],
          ].map(([name, party, blurb]) => (
            <div key={name} className="card" style={{ padding: 16 }}>
              <strong>{name}</strong>
              <p className="muted" style={{ marginTop: 4 }}>{party}</p>
              <p className="faint" style={{ marginTop: 6 }}>{blurb}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <Link href="/vote" className="btn btn-primary">
          View ballot
        </Link>
      </div>
    </main>
  );
}
