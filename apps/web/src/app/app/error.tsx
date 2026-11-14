'use client';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="onboard" role="alert">
      <h1>Something slipped</h1>
      <p className="muted">Your data is safe. Give it another try.</p>
      <div className="onboard-ctas">
        <button className="btn btn-accent" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
