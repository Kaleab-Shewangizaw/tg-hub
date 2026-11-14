'use client';

import { useEffect, useState } from 'react';
import { IconMoon, IconSun } from './icons';

/** Toggles light/dark. Starts from the system preference until the user chooses. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const explicit = document.documentElement.dataset.theme;
    setDark(explicit ? explicit === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('emberly-theme', next ? 'dark' : 'light');
    } catch {}
  };

  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
      {dark ? <IconSun size={17} /> : <IconMoon size={17} />}
    </button>
  );
}
