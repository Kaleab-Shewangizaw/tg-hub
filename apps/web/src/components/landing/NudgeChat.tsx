'use client';

import { useEffect, useState } from 'react';
import { useInView, useReducedMotion } from './Reveal';

/** A short chat with the bot that plays out once it scrolls into view. */

const SCRIPT: { from: 'bot' | 'you'; text: string; wait: number }[] = [
  { from: 'bot', text: 'Evening 👋 One post today keeps your 12-week streak going.', wait: 900 },
  { from: 'you', text: 'On it.', wait: 1500 },
  { from: 'bot', text: '🔥 Streak saved. 13 weeks.', wait: 1700 },
];

export function NudgeChat() {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  const [count, setCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView || reduced) return;
    let cancelled = false;
    const timers: number[] = [];
    let t = 0;
    SCRIPT.forEach((m, i) => {
      t += m.wait;
      if (m.from === 'bot') timers.push(window.setTimeout(() => !cancelled && setTyping(true), t - 800));
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setTyping(false);
          setCount(i + 1);
        }, t),
      );
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [inView, reduced]);

  return (
    <div ref={ref} className="chat" aria-label="Example reminder from the Tally bot">
      <div className="chat-top">
        <span className="chat-avatar" aria-hidden />
        <span>
          <strong>Tally</strong>
          <span>bot</span>
        </span>
      </div>
      <div className="chat-body">
        {SCRIPT.slice(0, reduced ? SCRIPT.length : count).map((m) => (
          <p key={m.text} className={`bubble from-${m.from}`}>
            {m.text}
          </p>
        ))}
        {typing ? (
          <p className="bubble from-bot typing" aria-hidden>
            <span />
            <span />
            <span />
          </p>
        ) : null}
      </div>
    </div>
  );
}
