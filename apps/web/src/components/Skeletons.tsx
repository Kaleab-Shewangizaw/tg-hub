export function DashboardSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      <div className="page-head">
        <div className="stack" style={{ gap: 10 }}>
          <span className="skeleton" style={{ height: 14, width: 120 }} />
          <span className="skeleton" style={{ height: 34, width: 280 }} />
        </div>
      </div>
      <div className="dash">
        <span className="skeleton" style={{ height: 150, borderRadius: 20, gridColumn: 'span 2' }} />
        <span className="skeleton" style={{ height: 150, borderRadius: 20 }} />
        <span className="skeleton" style={{ height: 150, borderRadius: 20 }} />
        <span className="skeleton dash-wide" style={{ height: 240, borderRadius: 20 }} />
      </div>
    </div>
  );
}

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton" style={{ height: 120, borderRadius: 20 }} />
      ))}
    </div>
  );
}
