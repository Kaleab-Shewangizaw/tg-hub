'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from './Reveal';

/**
 * The hero: a Telegram-style channel where posts keep arriving, and each new
 * post lights the next square on the grid underneath. Loops gently.
 */

const POSTS = [
  { text: 'Morning light over the river', react: '🔥 24' },
  { text: 'Three things I learned this week', react: '👍 41' },
  { text: 'New episode is out', react: '❤️ 63' },
  { text: 'Behind the scenes, part 2', react: '🔥 37' },
  { text: 'A short one today', react: '👏 19' },
  { text: 'Your questions, answered', react: '❤️ 52' },
  { text: 'Sunday notes', react: '🎉 28' },
];

const COLS = 14;

export function HeroChannel({ levels }: { levels: number[] }) {
  // `levels`: COLS × 7 intensities (column-major), the last column left empty to fill.
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % (POSTS.length + 2)), 1900);
    return () => window.clearInterval(id);
  }, [reduced]);

  const shown = reduced ? POSTS.length : Math.min(step, POSTS.length);
  const visible = POSTS.slice(Math.max(0, shown - 3), shown);
  const lastCol = (COLS - 1) * 7;

  return (
    <div className="hc" aria-hidden>
      <div className="hc-top">
        <span className="hc-avatar">F</span>
        <span className="hc-name">
          <strong>Field Notes</strong>
          <span>2,481 subscribers</span>
        </span>
        <span className="hc-week mono">
          <b key={shown}>{shown}</b>/7 this week
        </span>
      </div>
      <div className="hc-feed">
        {visible.map((p, i) => (
          <div key={`${p.text}-${shown}`} className="hc-post" style={{ ['--k' as string]: visible.length - 1 - i }}>
            <p>{p.text}</p>
            <span className="hc-react">{p.react}</span>
          </div>
        ))}
        {shown === 0 ? <div className="hc-empty">Waiting for today’s post…</div> : null}
      </div>
      <div className="hc-grid">
        {levels.map((lv, i) => {
          const fresh = i >= lastCol && i - lastCol < shown;
          return <span key={i} className={`hc-cell lv${fresh ? 3 : lv} ${fresh && i - lastCol === shown - 1 ? 'is-new' : ''}`} />;
        })}
      </div>
    </div>
  );
}
