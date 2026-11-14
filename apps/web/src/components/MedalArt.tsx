import type { MedalId } from '@emberly/core';

/**
 * Original medal artwork: a soft rosette with a glyph per medal. Locked
 * medals render as an outline so progress reads without color alone.
 */
const GLYPHS: Record<MedalId, React.ReactNode> = {
  'first-spark': <path d="M32 18c5 5 8 9.4 8 13.4a8 8 0 0 1-16 0C24 27.4 27 23 32 18Zm0 9c-2 2-3 3.8-3 5.2a3 3 0 0 0 6 0c0-1.4-1-3.2-3-5.2Z" />,
  'body-of-work': (
    <>
      <rect x="22" y="21" width="16" height="20" rx="2.5" />
      <rect x="26" y="25" width="16" height="20" rx="2.5" opacity="0.6" />
    </>
  ),
  'kept-rhythm': <path d="M20 36c3 0 3-8 6-8s3 12 6 12 3-16 6-16 3 12 6 12" fill="none" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />,
  'welcome-back': <path d="M24 30a9 9 0 1 1 3 7.5M24 30v-6M24 30h6" fill="none" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />,
  'crowd-favorite': (
    <>
      <circle cx="32" cy="24" r="5" />
      <circle cx="25" cy="33" r="5" />
      <circle cx="39" cy="33" r="5" />
      <circle cx="32" cy="38" r="5" opacity="0.6" />
    </>
  ),
};

export function MedalArt({ id, earned, tier = 0, size = 64 }: { id: MedalId; earned: boolean; tier?: number; size?: number }) {
  const petals = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={`medal-art ${earned ? 'is-earned' : 'is-locked'}`} data-tier={tier}>
      <g className="medal-rosette">
        {petals.map((deg) => (
          <ellipse key={deg} cx="32" cy="9" rx="6" ry="9" transform={`rotate(${deg} 32 32)`} />
        ))}
      </g>
      <circle cx="32" cy="32" r="20" className="medal-face" />
      <g className="medal-glyph">{GLYPHS[id]}</g>
    </svg>
  );
}
