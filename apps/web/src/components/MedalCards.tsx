import { formatShortDate, type MedalAward } from '@emberly/core';
import { Meter } from './Dashboard';
import { MedalArt } from './MedalArt';

const fmt = (n: number) => n.toLocaleString('en-US');

function Earned({ m }: { m: MedalAward }) {
  return (
    <li className="medal-card">
      <div className="medal-stage">
        <MedalArt mark={m.mark} tier={m.tier} size={104} />
      </div>
      <div className="medal-card-body">
        <div className="medal-card-title">
          <h3>{m.name}</h3>
          <span className="medal-when">
            {m.tier > 1 ? `×${m.tier} · ` : ''}
            {m.earnedOn ? formatShortDate(m.earnedOn) : 'Earned'}
          </span>
        </div>
        {m.because ? <p className="because">{m.because}</p> : null}
        {m.next ? (
          <div className="medal-next">
            <div className="next-medal-top">
              <span className="small muted">Next: ×{m.tier + 1}</span>
              <span className="mono faint small">
                {fmt(Math.min(m.next.current, m.next.target))}/{fmt(m.next.target)}
              </span>
            </div>
            <Meter value={m.next.current} max={m.next.target} label={`Progress toward ${m.name} ×${m.tier + 1}`} />
          </div>
        ) : (
          <p className="small faint">Highest tier reached.</p>
        )}
      </div>
    </li>
  );
}

export function MedalCards({ medals }: { medals: MedalAward[] }) {
  const earned = medals.filter((m) => m.earned).sort((a, b) => b.tier - a.tier || (b.earnedOn ?? '').localeCompare(a.earnedOn ?? ''));
  const todo = medals.filter((m) => !m.earned && m.next).sort((a, b) => b.next!.current / b.next!.target - a.next!.current / a.next!.target);
  return (
    <div className="stack" style={{ gap: 36 }}>
      {earned.length > 0 ? (
        <ul className="medal-grid" aria-label="Earned medals">
          {earned.map((m) => (
            <Earned key={m.id} m={m} />
          ))}
        </ul>
      ) : (
        <div className="panel empty-medals">
          <p>No medals yet.</p>
          <p className="faint small">They appear here once you earn them, starting with 100 reactions on a single post.</p>
        </div>
      )}

      {todo.length > 0 ? (
        <section aria-labelledby="todo-h">
          <h2 id="todo-h" className="eyebrow">
            Still to earn
          </h2>
          <ul className="medal-todo panel">
            {todo.map((m) => (
              <li key={m.id}>
                <div className="medal-todo-text">
                  <strong>{m.name}</strong>
                  <span className="small muted">{m.rule}</span>
                </div>
                <div className="medal-todo-progress">
                  <span className="mono small faint">
                    {fmt(Math.min(m.next!.current, m.next!.target))}/{fmt(m.next!.target)}
                  </span>
                  <Meter value={m.next!.current} max={m.next!.target} label={`Progress toward ${m.name}`} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
