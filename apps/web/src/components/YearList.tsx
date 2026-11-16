import Link from 'next/link';

/**
 * GitHub-style year switcher beside the activity grid. The newest year shows
 * the rolling last 12 months; older years show January to December.
 * Server pages pass `href` (adds ?year=); the client-only demo passes `onSelect`.
 */
export function YearList({
  years,
  active,
  href,
  onSelect,
}: {
  years: number[];
  /** Selected calendar year, or null for the rolling view (newest year). */
  active: number | null;
  href?: string;
  onSelect?: (year: number | null) => void;
}) {
  if (years.length < 2) return null;
  const current = years[0]!;
  return (
    <nav className="years" aria-label="Activity year">
      {years.map((y) => {
        const value = y === current ? null : y;
        const isActive = value === active;
        const label = String(y);
        if (onSelect) {
          return (
            <button key={y} type="button" aria-current={isActive ? 'true' : undefined} onClick={() => onSelect(value)}>
              {label}
            </button>
          );
        }
        return (
          <Link key={y} href={value == null ? href! : `${href}?year=${y}`} scroll={false} aria-current={isActive ? 'true' : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Parses ?year= into a number, or null. */
export function parseYear(value: unknown): number | null {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
}
