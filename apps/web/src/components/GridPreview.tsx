import type { ActivityGrid } from '@emberly/core';

/** Decorative, non-interactive grid (landing, explore cards). `animated` fills it in column by column. */
export function GridPreview({ grid, weeks = grid.weeks.length, animated = false }: { grid: ActivityGrid; weeks?: number; animated?: boolean }) {
  const cols = grid.weeks.slice(-weeks);
  return (
    <div className={`gp ${animated ? 'is-animated' : ''}`} style={{ ['--cols' as string]: cols.length }} aria-hidden>
      {cols.map((week, i) => (
        <div className="gp-col" key={week[0]!.date} style={animated ? { ['--i' as string]: i } : undefined}>
          {week.map((c, r) => (
            <span key={c.date} className={`gp-cell lv${c.state === 'future' ? 'x' : c.level}`} data-state={c.state} style={animated ? { ['--r' as string]: r } : undefined} />
          ))}
        </div>
      ))}
    </div>
  );
}
