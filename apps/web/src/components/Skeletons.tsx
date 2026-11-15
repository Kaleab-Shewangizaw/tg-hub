export function DashboardSkeleton() {
  return (
    <div className="stack" style={{ gap: 20 }} aria-busy="true" aria-label="Loading">
      <div className="page-head">
        <div className="stack" style={{ gap: 8 }}>
          <span className="skeleton" style={{ height: 14, width: 110, borderRadius: 6 }} />
          <span className="skeleton" style={{ height: 28, width: 260, borderRadius: 6 }} />
        </div>
      </div>
      <div className="dash">
        <span className="skeleton skel-goal" style={{ height: 148 }} />
        <span className="skeleton" style={{ height: 148 }} />
        <span className="skeleton" style={{ height: 148 }} />
        <span className="skeleton dash-wide" style={{ height: 240 }} />
      </div>
    </div>
  );
}

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      <span className="skeleton" style={{ height: 28, width: 200, borderRadius: 6 }} />
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton" style={{ height: 120 }} />
      ))}
    </div>
  );
}
