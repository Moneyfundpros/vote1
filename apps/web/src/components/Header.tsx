import Link from 'next/link';

/** Top pill-style nav for the updated dark neon theme. */
export function Header() {
  return (
    <header className="site-header">
      <div className="container bar">
        <Link href="/" className="brand">
          <span className="dot" aria-hidden>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          Voter
        </Link>
        <nav className="nav">
          <Link href="/polls">Polls</Link>
          <Link href="/candidates">Candidates</Link>
          <Link href="/explorer">Transparency</Link>
          <Link href="/login">Login</Link>
          <Link href="/register" className="btn btn-primary header-cta">
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}
