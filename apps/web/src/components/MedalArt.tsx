'use client';

import { useId } from 'react';

/**
 * A medal as a minted coin, like a GitHub achievement: round, with visible
 * thickness, a reeded edge and a sunken face carrying the medal's mark (an
 * emoji, a number or a star). The metal shows the tier and higher tiers get
 * a ×2 / ×3 / ×4 pill, so the tier never relies on colour alone.
 */

type Metal = 'steel' | 'bronze' | 'silver' | 'gold';

const METALS: Record<Metal, { hi: string; base: string; lo: string; deep: string; pill: string; pillInk: string }> = {
  steel: { hi: '#dce8ff', base: '#7fa3e0', lo: '#3e5f9c', deep: '#1d3260', pill: '#2f6fe0', pillInk: '#ffffff' },
  bronze: { hi: '#ffd8b0', base: '#c9813f', lo: '#7d441a', deep: '#45230a', pill: '#b8692c', pillInk: '#ffffff' },
  silver: { hi: '#ffffff', base: '#cdd3dc', lo: '#858d9a', deep: '#40464f', pill: '#8b94a3', pillInk: '#ffffff' },
  gold: { hi: '#fff5c4', base: '#ebb533', lo: '#a2690a', deep: '#573700', pill: '#d79e17', pillInk: '#1a1200' },
};

const LADDER: Metal[] = ['steel', 'bronze', 'silver', 'gold'];

export function metalFor(tier: number): Metal {
  return LADDER[Math.min(Math.max(tier, 1), LADDER.length) - 1]!;
}

/** Text marks look engraved; emoji marks sit on the face in colour. */
const isText = (mark: string) => /^[0-9★+K]+$/.test(mark);

export function MedalArt({ mark, tier = 1, size = 64, showTier = true }: { mark: string; tier?: number; size?: number; showTier?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const metal = metalFor(tier);
  const m = METALS[metal];
  const ref = (name: string) => `url(#${uid}-${name})`;
  const cx = 50;
  const cy = 48;
  const R = 44;
  const reeds = Array.from({ length: 72 }, (_, i) => i * 5);
  const text = isText(mark);

  return (
    <span className={`coin metal-${metal}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="coin-art">
        <defs>
          <linearGradient id={`${uid}-rim`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor={m.hi} />
            <stop offset="0.4" stopColor={m.base} />
            <stop offset="1" stopColor={m.lo} />
          </linearGradient>
          <linearGradient id={`${uid}-well`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor={m.lo} />
            <stop offset="1" stopColor={m.hi} />
          </linearGradient>
          <radialGradient id={`${uid}-face`} cx="0.38" cy="0.3" r="0.8">
            <stop offset="0" stopColor={m.hi} />
            <stop offset="0.55" stopColor={m.base} />
            <stop offset="1" stopColor={m.lo} />
          </radialGradient>
          <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${uid}-disc`}>
            <circle cx={cx} cy={cy} r={R} />
          </clipPath>
        </defs>

        {/* Thickness: the coin's edge showing below its face. */}
        <circle cx={cx} cy={cy + 4} r={R} fill={m.deep} />
        <circle cx={cx} cy={cy + 2.5} r={R} fill={m.lo} />

        {/* Rim with a reeded edge. */}
        <circle cx={cx} cy={cy} r={R} fill={ref('rim')} />
        <g stroke={m.deep} strokeWidth="0.9" opacity="0.3">
          {reeds.map((deg) => (
            <line key={deg} x1={cx} y1={cy - R + 0.8} x2={cx} y2={cy - R + 4} transform={`rotate(${deg} ${cx} ${cy})`} />
          ))}
        </g>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={m.deep} strokeOpacity="0.4" strokeWidth="1" />

        {/* Sunken face. */}
        <circle cx={cx} cy={cy} r={R - 7} fill={ref('well')} />
        <circle cx={cx} cy={cy} r={R - 9} fill={ref('face')} />
        <circle cx={cx} cy={cy} r={R - 13} fill="none" stroke={m.deep} strokeOpacity="0.18" strokeWidth="0.8" strokeDasharray="1.5 2.5" />

        {text ? (
          <g textAnchor="middle" style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif', fontWeight: 800, fontSize: mark.length > 2 ? 24 : 30, letterSpacing: '-0.04em' }}>
            <text x={cx + 0.8} y={cy + 10.8} fill={m.hi} opacity="0.85">
              {mark}
            </text>
            <text x={cx - 0.6} y={cy + 9.4} fill={m.deep} opacity="0.75">
              {mark}
            </text>
            <text x={cx} y={cy + 10} fill={m.lo}>
              {mark}
            </text>
          </g>
        ) : (
          <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: 34 }} className="coin-emoji">
            {mark}
          </text>
        )}

        <g clipPath={ref('disc')} className="coin-sheen">
          <path d={`M ${cx - R} ${cy - R} L ${cx + 10} ${cy - R} L ${cx - R} ${cy + 12} Z`} fill={ref('sheen')} />
        </g>
      </svg>
      {showTier && tier > 1 ? (
        <span className="coin-tier" style={{ background: m.pill, color: m.pillInk, fontSize: Math.max(10, Math.round(size * 0.13)) }}>
          ×{tier}
        </span>
      ) : null}
    </span>
  );
}
