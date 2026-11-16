'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './Reveal';

/**
 * "A year, as you scroll": a tall section with a sticky stage. Scrolling
 * moves `--p` from 0 to 1; each cell fades in when the progress reaches its
 * day (pure CSS, no re-render per cell). The counter and month follow along.
 */

const CAPTIONS = ['A quiet start.', 'Finding a rhythm.', 'Showing up, week after week.', 'A year you can see.'];

export function ScrollYear({ levels, cumulative, months, cols }: { levels: number[]; cumulative: number[]; months: string[]; cols: number }) {
  const ref = useRef<HTMLElement>(null);
  const [progress, setP] = useState(0);
  const reduced = useReducedMotion();
  const p = reduced ? 1 : progress;

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      setP(Math.min(1, Math.max(0, total > 0 ? -r.top / total : 1)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const n = levels.length;
  const shown = Math.min(n, Math.floor(p * 1.08 * n));
  const idx = Math.max(0, shown - 1);
  const stage = Math.min(CAPTIONS.length - 1, Math.floor(p * CAPTIONS.length * 1.02));

  return (
    <section ref={ref} className="sy" aria-label="A sample year of posts filling in as you scroll">
      <div className="sy-stage">
        <div className="sy-head">
          <p className="sy-month mono">{shown ? months[idx] : ' '}</p>
          <p className="sy-count mono">
            {(shown ? cumulative[idx]! : 0).toLocaleString('en-US')}
            <span>posts</span>
          </p>
        </div>
        <div className="sy-grid" style={{ ['--p' as string]: p * 1.08 * n, ['--cols' as string]: cols }}>
          {levels.map((lv, i) => (
            <span key={i} className={`sy-cell lv${lv}`} style={{ ['--k' as string]: i }} />
          ))}
        </div>
        <div className="sy-captions">
          {CAPTIONS.map((c, i) => (
            <p key={c} className={i === stage ? 'is-on' : ''}>
              {c}
            </p>
          ))}
        </div>
        <div className="sy-progress" style={{ transform: `scaleX(${p})` }} />
      </div>
    </section>
  );
}
