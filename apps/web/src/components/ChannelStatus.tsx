import type { ConnectionStatus, DataSource } from '@emberly/core';

const STATUS: Record<ConnectionStatus, { label: string; tone: string }> = {
  active: { label: 'Tracking', tone: 'chip-mint' },
  pending: { label: 'Finishing setup', tone: 'chip-amber' },
  needs_attention: { label: 'Needs a look', tone: 'chip-amber' },
  disconnected: { label: 'Paused', tone: 'chip-slate' },
};

export function ChannelStatusChip({ status }: { status: ConnectionStatus }) {
  const s = STATUS[status];
  return <span className={`chip chip-dot ${s.tone}`}>{s.label}</span>;
}

export function SourceChip({ source }: { source: DataSource }) {
  if (source === 'live') return null;
  const label = { simulated: 'Simulated', demo: 'Demo', import: 'Imported' }[source];
  return <span className="chip chip-outline">{label}</span>;
}
