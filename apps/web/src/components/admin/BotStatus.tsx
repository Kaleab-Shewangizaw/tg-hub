export function BotStatusRows({ rows }: { rows: { label: string; value: string; tone?: 'ok' | 'warn' }[] }) {
  return (
    <dl className="adm-facts">
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd className={r.tone ? `tone-${r.tone}` : undefined}>
            {r.tone ? <span className="status-dot" aria-hidden /> : null}
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
