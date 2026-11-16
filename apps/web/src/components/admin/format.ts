/** Compact relative time for admin tables: "just now", "5m", "3h", "4d", then a date. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return 'Never';
  const mins = Math.round((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return day(iso);
}

export function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export const fmt = (n: number) => n.toLocaleString('en-US');
