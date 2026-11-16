import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="auth">
      <div className="onboard" style={{ maxWidth: 440, width: '100%' }}>
        <p className="faint small">404</p>
        <h1 style={{ marginTop: 0 }}>Page not found</h1>
        <p className="muted">This page doesn’t exist or has moved.</p>
        <div className="onboard-ctas">
          <Link href="/" className="btn btn-accent">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
