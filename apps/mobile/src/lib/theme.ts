import { useColorScheme } from 'react-native';

/** Mirrors the web design tokens (apps/web/src/app/globals.css). */
const light = {
  bg: '#faf6f0',
  surface: '#fffdf9',
  surface2: '#f3ece2',
  ink: '#2b2420',
  ink2: '#645750',
  ink3: '#8a7c72',
  line: '#e7ded2',
  lineStrong: '#d6c9b9',
  accent: '#b84d1a',
  onAccent: '#ffffff',
  accentInk: '#9a3f12',
  accentSoft: '#fbe6d4',
  sage: '#3f6b52',
  sageSoft: '#e1ede4',
  dusk: '#5b5894',
  duskSoft: '#e8e7f4',
  amber: '#8a5a07',
  amberSoft: '#fbf0d6',
  grid: ['#ece3d7', '#f6d6b0', '#eead72', '#d97a39', '#a24a19'],
};

const dark: typeof light = {
  bg: '#161210',
  surface: '#1f1a16',
  surface2: '#2a231e',
  ink: '#f3ebe2',
  ink2: '#c2b4a8',
  ink3: '#94867b',
  line: '#362e28',
  lineStrong: '#4a3f37',
  accent: '#f08a4f',
  onAccent: '#1b120c',
  accentInk: '#f5a274',
  accentSoft: '#3a2416',
  sage: '#8fc0a1',
  sageSoft: '#1f2e26',
  dusk: '#aeabe0',
  duskSoft: '#2a2940',
  amber: '#e9b95a',
  amberSoft: '#352a12',
  grid: ['#2a231e', '#4f3320', '#844c24', '#c56b2f', '#f7a35f'],
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** System serif for display text; keeps the app free of bundled font files. */
export const serif = 'Georgia';
