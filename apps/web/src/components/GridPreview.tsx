import type { ActivityGrid } from '@emberly/core';

/** Decorative, non-interactive grid used on the landing page. */
export function GridPreview({ grid, weeks = grid.weeks.length }: { grid: ActivityGrid; weeks?: number }) {
  const cols = grid.weeks.slice(-weeks);
  return (
    <div className="gp" style={{ ['--cols' as string]: cols.length }} aria-hidden>
      {cols.map((week) => (
        <div className="gp-col" key={week[0]!.date}>
          {week.map((c) => (
            <span key={c.date} className={`gp-cell lv${c.state === 'future' ? 'x' : c.level}`} data-state={c.state} />
          ))}
        </div>
      ))}
    </div>
  );
}
