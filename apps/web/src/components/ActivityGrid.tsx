'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatLongDate, WEEKDAY_SHORT, type ActivityGrid as Grid, type DayPost, type GridCell, type PeriodStatus } from '@emberly/core';

/**
 * Activity grid. Rows are weekdays, columns are weeks (newest right).
 * ARIA grid with a roving tab stop: Tab enters once, arrow keys move, Home
 * jumps to the first week, End back to today. The line underneath announces
 * the selected or hovered day.
 */

interface Props {
  grid: Grid;
  dayPosts: Record<string, DayPost[]>;
  weekGoals: Record<string, { status: PeriodStatus; posted: number; target: number }> | null;
  today: string;
}

export function ActivityGrid({ grid, dayPosts, weekGoals, today }: Props) {
  const cols = grid.weeks.length;
  const initial = useMemo(() => {
    for (let c = cols - 1; c >= 0; c--) {
      const r = grid.weeks[c]!.findIndex((cell) => cell.date === today);
      if (r >= 0) return { r, c };
    }
    return { r: 0, c: cols - 1 };
  }, [grid, cols, today]);

  const [pos, setPos] = useState(initial);
  const [hover, setHover] = useState<GridCell | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const selected = grid.weeks[pos.c]![pos.r]!;
  const shown = hover ?? selected;

  const move = (dr: number, dc: number, to?: { r: number; c: number }) => {
    let r = Math.max(0, Math.min(6, to?.r ?? pos.r + dr));
    let c = Math.max(0, Math.min(cols - 1, to?.c ?? pos.c + dc));
    while (c >= 0 && grid.weeks[c]![r]!.state === 'future') {
      if (r > 0 && dc === 0) r -= 1;
      else c -= 1;
    }
    if (c < 0) return;
    setPos({ r, c });
    cellRefs.current.get(`${r}:${c}`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => move(0, -1),
      ArrowRight: () => move(0, 1),
      ArrowUp: () => move(-1, 0),
      ArrowDown: () => move(1, 0),
      Home: () => move(0, 0, { r: pos.r, c: 0 }),
      End: () => move(0, 0, initial),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const posts = dayPosts[shown.date] ?? [];
  const [dayTitle] = shown.label.split(':');
  const summary =
    shown.state === 'untracked'
      ? 'Before tracking'
      : shown.state === 'paused' && shown.count === 0
        ? 'On a break'
        : shown.state === 'rest' && shown.count === 0
          ? 'Rest day'
          : shown.count === 0
            ? 'No posts'
            : `${shown.count} post${shown.count === 1 ? '' : 's'}${shown.goalMet ? ' · goal met' : ''}`;

  return (
    <div className="ag">
      <div className="ag-scroll" ref={scroller}>
        <div className="ag-frame" style={{ ['--cols' as string]: cols }}>
          <div className="ag-months" aria-hidden>
            {grid.months.map((m) => (
              <span key={`${m.column}-${m.label}`} style={{ gridColumn: m.column + 1 }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="ag-days" aria-hidden>
            {grid.rowWeekdays.map((wd, i) => (
              <span key={wd}>{i % 2 === 0 ? WEEKDAY_SHORT[wd] : ''}</span>
            ))}
          </div>
          <div
            className="ag-grid"
            role="grid"
            aria-label={`Posting activity from ${formatLongDate(grid.range.start)} to ${formatLongDate(today)}. Use arrow keys to move between days.`}
            aria-readonly
            onKeyDown={onKeyDown}
            onMouseLeave={() => setHover(null)}
          >
            {Array.from({ length: 7 }, (_, r) => (
              <div role="row" className="ag-row" key={r}>
                {grid.weeks.map((week, c) => {
                  const cell = week[r]!;
                  if (cell.state === 'future') return <div role="gridcell" key={c} className="ag-cell is-future" aria-hidden />;
                  const isSel = r === pos.r && c === pos.c;
                  return (
                    <div
                      role="gridcell"
                      key={c}
                      ref={(el) => {
                        if (el) cellRefs.current.set(`${r}:${c}`, el);
                      }}
                      tabIndex={isSel ? 0 : -1}
                      aria-label={cell.label}
                      aria-selected={isSel}
                      data-state={cell.state}
                      data-goal={cell.goalMet ? 'met' : undefined}
                      data-today={cell.isToday || undefined}
                      className={`ag-cell lv${cell.level}`}
                      onClick={() => setPos({ r, c })}
                      onMouseEnter={() => setHover(cell)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {weekGoals ? (
            <div className="ag-weeks" aria-hidden>
              {grid.weeks.map((week, c) => (
                <span key={c} className={`ag-wk is-${weekGoals[week[0]!.date]?.status ?? 'none'}`} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="ag-foot">
        <div className="ag-day" aria-live="polite">
          <span className="ag-day-date">{dayTitle?.replace(/ \(today\)$/, '')}</span>
          <span className="ag-day-sum">{summary}</span>
          {posts.slice(0, 2).map((p) => (
            <span key={p.id} className="ag-day-post">
              {p.time} · {p.preview ?? kindLabel(p.kind)}
            </span>
          ))}
          {posts.length > 2 ? <span className="faint small">+{posts.length - 2}</span> : null}
        </div>
        <div className="ag-legend" aria-label={`Legend: no posts, ${grid.buckets.map((b) => b.label).join(', ')}. Outlined squares are rest days, striped are breaks.`}>
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`ag-cell lv${l}`} aria-hidden title={l === 0 ? 'No posts' : grid.buckets[l - 1]?.label} />
          ))}
          <span>More</span>
          <span className="ag-legend-sep" />
          <span className="ag-cell" data-state="rest" aria-hidden /> <span>Rest</span>
          <span className="ag-cell" data-state="paused" aria-hidden /> <span>Break</span>
        </div>
      </div>
    </div>
  );
}

export function kindLabel(kind: DayPost['kind']): string {
  const labels: Record<DayPost['kind'], string> = {
    text: 'Text post',
    photo: 'Photo',
    video: 'Video',
    audio: 'Audio',
    voice: 'Voice note',
    document: 'File',
    poll: 'Poll',
    sticker: 'Sticker',
    other: 'Post',
  };
  return labels[kind];
}
