/** Initial on a soft colour picked from the handle, so each creator has their own. */
export function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({ name, seed, size = 40, className = '' }: { name: string; seed: string; size?: number; className?: string }) {
  return (
    <span
      className={`avatar-u ${className}`}
      style={{ ['--h' as string]: hueFor(seed), width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden
    >
      {name.trim()[0]?.toUpperCase() ?? '·'}
    </span>
  );
}
