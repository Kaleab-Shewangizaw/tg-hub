'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconCompass, IconHome, IconLink, IconSliders } from './icons';

const LINKS = [
  { href: '/app', label: 'Overview', Icon: IconHome },
  { href: '/explore', label: 'Explore', Icon: IconCompass },
  { href: '/app/channels', label: 'Channels', Icon: IconLink },
  { href: '/app/settings', label: 'Settings', Icon: IconSliders },
];

export function NavLinks({ variant }: { variant: 'top' | 'bottom' }) {
  const path = usePathname();
  return (
    <nav className={variant === 'top' ? 'topnav' : 'bottomnav'} aria-label="Main">
      {LINKS.map(({ href, label, Icon }) => {
        const active = href === '/app' ? path === '/app' : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            {variant === 'bottom' ? <Icon size={22} /> : null}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
