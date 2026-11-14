import { formatShortDate, type MedalAward } from '@emberly/core';
import { Meter } from './Dashboard';
import { MedalArt } from './MedalArt';

export function MedalCards({ medals }: { medals: MedalAward[] }) {
  const sorted = [...medals].sort((a, b) => Number(b.earned) - Number(a.earned));
  return (
    <ul className="medal-grid">
      {sorted.map((m) => (
        <li key={m.id} className={`medal-card ${m.earned ? '' : 'is-locked'}`}>
          <div className="medal-card-art">
            <MedalArt id={m.id} earned={m.earned} tier={m.tier} size={64} />
            {m.earned ? (
              <span className="chip chip-accent">{m.earnedOn ? formatShortDate(m.earnedOn) : 'Earned'}</span>
            ) : (
              <span className="chip">Locked</span>
            )}
          </div>
          <div>
            <h2>{m.name}</h2>
            <p className="rule">{m.rule}</p>
          </div>
          {m.tierCount > 1 ? (
            <div className="tiers" aria-label={`Tier ${m.tier} of ${m.tierCount}`}>
              {Array.from({ length: m.tierCount }, (_, i) => (
                <span key={i} className={i < m.tier ? 'on' : ''} />
              ))}
            </div>
          ) : null}
          {m.because ? <p className="because">{m.because}</p> : null}
          {m.next ? (
            <div className="stack" style={{ gap: 8 }}>
              <div className="next-medal-top">
                <span className="small muted">Next · {m.next.label}</span>
                <span className="faint small">
                  {Math.min(m.next.current, m.next.target)}/{m.next.target}
                </span>
              </div>
              <Meter value={m.next.current} max={m.next.target} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
