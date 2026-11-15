import { formatShortDate, type MedalAward } from '@emberly/core';
import { Meter } from './Dashboard';
import { MedalArt } from './MedalArt';

function Card({ m }: { m: MedalAward }) {
  return (
    <li className={`medal-card ${m.earned ? '' : 'is-locked'}`}>
      <div className="medal-card-head">
        <MedalArt id={m.id} earned={m.earned} tier={m.tier} size={52} />
        <div>
          <h3>{m.name}</h3>
          {m.earned ? (
            <span className="faint small">{m.earnedOn ? `Earned ${formatShortDate(m.earnedOn)}` : 'Earned'}</span>
          ) : (
            <span className="faint small">Not earned yet</span>
          )}
        </div>
      </div>
      <p className="rule">{m.rule}</p>
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
            <span className="small muted">{m.next.label}</span>
            <span className="faint small">
              {Math.min(m.next.current, m.next.target)}/{m.next.target}
            </span>
          </div>
          <Meter value={m.next.current} max={m.next.target} label={`Progress toward ${m.next.label}`} />
        </div>
      ) : null}
    </li>
  );
}

export function MedalCards({ medals }: { medals: MedalAward[] }) {
  const earned = medals.filter((m) => m.earned);
  const locked = medals.filter((m) => !m.earned);
  return (
    <div className="stack" style={{ gap: 28 }}>
      {earned.length > 0 ? (
        <section aria-labelledby="earned-h">
          <h2 id="earned-h" className="medal-section-title">
            Earned
          </h2>
          <ul className="medal-grid">
            {earned.map((m) => (
              <Card key={m.id} m={m} />
            ))}
          </ul>
        </section>
      ) : null}
      {locked.length > 0 ? (
        <section aria-labelledby="locked-h">
          <h2 id="locked-h" className="medal-section-title">
            Still to earn
          </h2>
          <ul className="medal-grid">
            {locked.map((m) => (
              <Card key={m.id} m={m} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
