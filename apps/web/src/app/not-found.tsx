import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="auth">
      <div className="onboard" style={{ maxWidth: 480, width: '100%' }}>
        <h1>Nothing here</h1>
        <p className="muted">This page is taking a rest day.</p>
        <div className="onboard-ctas">
          <Link href="/" className="btn btn-accent">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
