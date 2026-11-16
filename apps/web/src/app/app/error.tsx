'use client';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="onboard" role="alert">
      <h1>Something went wrong</h1>
      <p className="muted">Your data is safe. Please try again.</p>
      <div className="onboard-ctas">
        <button className="btn btn-accent" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
