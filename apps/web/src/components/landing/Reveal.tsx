'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** Adds `is-in` once the element scrolls into view (once). CSS decides what that looks like. */
export function Reveal({ as: Tag = 'div', className = '', children, threshold = 0.25, ...rest }: { as?: 'div' | 'section' | 'li'; className?: string; children: React.ReactNode; threshold?: number } & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return (
    <Tag ref={ref as never} className={`reveal ${inView ? 'is-in' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** True once the element has been seen; for components that run their own sequence. */
export function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/** Whether the visitor asked for less motion. False on the server. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}
