import { day, fmt } from './format';

/** A small daily bar chart. Plain HTML, so it themes and scales with the page. */
export function Bars({ series, label, unit }: { series: { date: string; n: number }[]; label: string; unit: string }) {
  const max = Math.max(1, ...series.map((s) => s.n));
  const total = series.reduce((a, s) => a + s.n, 0);
  return (
    <figure className="bars" aria-label={`${label}: ${total} ${unit} over ${series.length} days`}>
      <div className="bars-plot">
        {series.map((s) => (
          <span key={s.date} className={s.n ? '' : 'is-zero'} style={{ height: `${Math.max(3, (s.n / max) * 100)}%` }} title={`${day(s.date)} · ${fmt(s.n)} ${unit}`} />
        ))}
      </div>
      <figcaption className="bars-axis mono">
        <span>{day(series[0]!.date).replace(/, \d{4}$/, '')}</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}
