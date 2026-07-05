import Link from 'next/link';

function Icon({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export default function Home() {
  return (
    <main>
      <section className="container hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="badge">Live civic trust platform</span>
            <h1 style={{ marginTop: 18 }}>
              Make every public vote feel <span className="hero-accent">credible, open, and tamper-evident</span>
            </h1>
            <p className="sub">
              Launch verified community polls, capture real human participation, and publish auditable results in minutes.
            </p>
            <div className="hero-cta">
              <div className="hero-input">
                <input type="email" placeholder="Enter your email or organization" aria-label="Enter your email or organization" />
                <Link href="/register" className="btn btn-primary btn-lg">
                  Launch a poll →
                </Link>
              </div>
              <div className="hero-actions">
                <Link href="/login" className="btn btn-ghost btn-lg">
                  Sign in
                </Link>
                <Link href="/register" className="btn btn-primary btn-lg">
                  Get started
                </Link>
              </div>
            </div>
            <p className="hero-fineprint">
              Built for trusted public opinion and transparent polling — designed for modern civic engagement.
            </p>
          </div>

          <div className="hero-visual" aria-label="Product dashboard preview">
            <div className="panel-top">
              <span className="chip">Live audit</span>
              <span className="chip muted">+12% verified turnout</span>
            </div>
            <div className="panel-body">
              <div className="panel-row">
                <div>
                  <span className="panel-label">Active polls</span>
                  <strong>28</strong>
                </div>
                <div>
                  <span className="panel-label">Verified voters</span>
                  <strong>18.2k</strong>
                </div>
              </div>
              <div className="panel-chart" style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1.05rem' }}>Trust score</strong>
                  <span style={{ color: '#c1ff5f', fontWeight: 700 }}>98.4%</span>
                </div>
                <svg viewBox="0 0 300 130" role="img" aria-label="Illustration of a secure public vote dashboard" style={{ width: '100%', height: 'auto' }}>
                  <rect x="22" y="24" width="256" height="92" rx="20" fill="rgba(193,255,95,0.08)" stroke="rgba(193,255,95,0.28)" />
                  <rect x="42" y="44" width="94" height="16" rx="8" fill="#c1ff5f" opacity="0.95" />
                  <rect x="42" y="72" width="150" height="10" rx="5" fill="rgba(255,255,255,0.72)" />
                  <rect x="42" y="90" width="118" height="10" rx="5" fill="rgba(255,255,255,0.5)" />
                  <circle cx="223" cy="74" r="32" fill="rgba(193,255,95,0.18)" stroke="rgba(193,255,95,0.38)" strokeWidth="3" />
                  <path d="M212 74l8 8 18-22" stroke="#c1ff5f" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                <div className="chart-labels">
                  <span>Voter turnout</span>
                  <span>89%</span>
                </div>
              </div>
            </div>
            <div className="panel-footnote">
              Secure vote receipts, audit history, and public transparency — all in one verified civic dashboard.
            </div>
          </div>
        </div>
      </section>

      <section className="container features">
        <div className="feature card">
          <div className="ic">
            <Icon path="M12 2 4 5v6c0 5 3.4 7.7 8 9 4.6-1.3 8-4 8-9V5l-8-3Z" />
          </div>
          <h3>One verified human, one vote</h3>
          <p>NIN/BVN identity verification stops duplicates and bots, so every result reflects real people.</p>
        </div>
        <div className="feature card">
          <div className="ic">
            <Icon path="M3 3v18h18M7 14l4-4 3 3 5-6" />
          </div>
          <h3>Real-time, tamper-evident results</h3>
          <p>Live counts you can trust, anchored in a Merkle audit log that anyone can verify.</p>
        </div>
        <div className="feature card">
          <div className="ic">
            <Icon path="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
          </div>
          <h3>Public transparency &amp; audit</h3>
          <p>Certified tallies, signed exports, and receipt verification — open for everyone to check.</p>
        </div>
      </section>
    </main>
  );
}
