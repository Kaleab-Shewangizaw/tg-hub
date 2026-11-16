'use client';

import { useEffect, useRef, useState } from 'react';
import { formatLongDate, WEEKDAY_SHORT, type ActivityGrid as Grid, type DayPost, type GridCell, type PeriodStatus } from '@emberly/core';
import { IconHeart } from './icons';

/**
 * Activity grid. Rows are weekdays, columns are weeks (newest right).
 *
 * Hovering a day shows a small tooltip ("3 posts on November 12"), like a
 * contribution graph. Clicking a day (or moving with the arrow keys) opens
 * that day's posts underneath. ARIA grid with a roving tab stop: Tab enters
 * once, arrows move, Home jumps to the first week, End back to today.
 */

interface Props {
  grid: Grid;
  dayPosts: Record<string, DayPost[]>;
  weekGoals: Record<string, { status: PeriodStatus; posted: number; target: number }> | null;
  today: string;
}

const dayName = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });

function tipText(cell: GridCell): string {
  const on = dayName(cell.date, { month: 'long', day: 'numeric' });
  if (cell.state === 'untracked') return `Not tracked yet on ${on}`;
  if (cell.count > 0) return `${cell.count} post${cell.count === 1 ? '' : 's'} on ${on}${cell.goalMet ? ' · goal met' : ''}`;
  if (cell.state === 'paused') return `On a break on ${on}`;
  if (cell.state === 'rest') return `Rest day on ${on}`;
  return `No posts on ${on}`;
}

/** Today's cell, or for a past year its last day. */
function initialPosition(grid: Grid, today: string): { r: number; c: number } {
  const cols = grid.weeks.length;
  for (let c = cols - 1; c >= 0; c--) {
    const r = grid.weeks[c]!.findIndex((cell) => cell.date === today);
    if (r >= 0) return { r, c };
  }
  for (let c = cols - 1; c >= 0; c--) {
    for (let r = 6; r >= 0; r--) if (grid.weeks[c]![r]!.state !== 'future') return { r, c };
  }
  return { r: 0, c: cols - 1 };
}

export function ActivityGrid({ grid, dayPosts, weekGoals, today }: Props) {
  const cols = grid.weeks.length;
  const initial = initialPosition(grid, today);

  const [pos, setPos] = useState(initial);
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const showTip = (el: HTMLElement, cell: GridCell) => {
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    const r = el.getBoundingClientRect();
    const below = r.top - box.top < 40;
    const x = Math.min(Math.max(r.left + r.width / 2 - box.left, 90), box.width - 90);
    setTip({ text: tipText(cell), x, y: below ? r.bottom - box.top + 8 : r.top - box.top - 8, below });
  };

  const selected = grid.weeks[pos.c]![pos.r]!;

  const move = (dr: number, dc: number, to?: { r: number; c: number }) => {
    let r = Math.max(0, Math.min(6, to?.r ?? pos.r + dr));
    let c = Math.max(0, Math.min(cols - 1, to?.c ?? pos.c + dc));
    while (c >= 0 && grid.weeks[c]![r]!.state === 'future') {
      if (r > 0 && dc === 0) r -= 1;
      else c -= 1;
    }
    if (c < 0) return;
    setPos({ r, c });
    const el = cellRefs.current.get(`${r}:${c}`);
    el?.focus();
    if (el) showTip(el, grid.weeks[c]![r]!);
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

  return (
    <div className="ag" ref={root}>
      <div className="ag-scroll" ref={scroller} onScroll={() => setTip(null)}>
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
            aria-label={`Posting activity from ${formatLongDate(grid.range.start)} to ${formatLongDate(grid.year ? grid.range.end : today)}. Use arrow keys to move between days.`}
            aria-readonly
            onKeyDown={onKeyDown}
            onMouseLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
          >
            {Array.from({ length: 7 }, (_, r) => (
              <div role="row" className="ag-row" key={r}>
                {grid.weeks.map((week, c) => {
                  const cell = week[r]!;
                  if (cell.state === 'future') return <div role="gridcell" key={c} className={`ag-cell ${cell.outside ? 'is-outside' : 'is-future'}`} aria-hidden />;
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
                      onMouseEnter={(e) => showTip(e.currentTarget, cell)}
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

      {tip ? (
        <div className={`ag-tip ${tip.below ? 'is-below' : ''}`} style={{ left: tip.x, top: tip.y }} aria-hidden>
          {tip.text}
        </div>
      ) : null}

      <div className="ag-legend-row">
        <p className="ag-hint">Click a day to see its posts</p>
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

      <DayDetail cell={selected} posts={dayPosts[selected.date] ?? []} />
    </div>
  );
}

function DayDetail({ cell, posts }: { cell: GridCell; posts: DayPost[] }) {
  const title = dayName(cell.date, { weekday: 'long', month: 'long', day: 'numeric' });
  const empty =
    cell.state === 'untracked'
      ? 'This was before tracking started.'
      : cell.state === 'paused'
        ? 'A planned break. It doesn’t count against your streak.'
        : cell.state === 'rest'
          ? 'A rest day. Nothing was expected.'
          : cell.isToday
            ? 'Nothing posted yet today.'
            : 'No posts this day.';
  return (
    <section className="day" aria-live="polite" aria-label={`Posts on ${title}`}>
      <header className="day-head">
        <h3>
          {title}
          {cell.isToday ? <span className="chip">Today</span> : null}
        </h3>
        <span className="faint small">
          {posts.length > 0 ? `${posts.length} post${posts.length === 1 ? '' : 's'}` : ''}
          {cell.goalMet ? ' · goal met' : ''}
        </span>
      </header>
      {posts.length === 0 ? (
        <p className="day-empty">{empty}</p>
      ) : (
        <ol className="day-posts">
          {posts.map((p) => {
            const body = (
              <>
                <time className="day-time">{p.time}</time>
                <span className="day-text">
                  <span className="day-preview">{p.preview ?? kindLabel(p.kind)}</span>
                  {p.preview && p.kind !== 'text' ? <span className="faint small">{kindLabel(p.kind)}</span> : null}
                </span>
                {p.reactions != null ? (
                  <span className="post-react">
                    <IconHeart size={13} /> {p.reactions}
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={p.id}>
                {p.url ? (
                  <a className="day-post" href={p.url} target="_blank" rel="noreferrer" title="Open in Telegram">
                    {body}
                  </a>
                ) : (
                  <div className="day-post">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
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
