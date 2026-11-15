import Link from 'next/link';
import { Suspense } from 'react';
import { signOutAction } from '@/app/actions/auth';
import { IconLogout, Logo } from '@/components/icons';
import { NavLinks } from '@/components/NavLinks';
import { ThemeToggle } from '@/components/ThemeToggle';
import { currentUser } from '@/server/auth';

async function UserMenu() {
  const user = await currentUser();
  if (!user) return null;
  return (
    <details className="menu">
      <summary className="avatar-btn" aria-label={`Account menu for ${user.name}`} title={user.name}>
        {user.name.trim()[0]?.toUpperCase() ?? '·'}
      </summary>
      <div className="menu-pop">
        <div className="menu-who">
          <p className="menu-name">{user.name}</p>
          <p className="faint small">{user.email}</p>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="menu-item">
            <IconLogout size={16} /> Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/app" className="brand" aria-label="Emberly overview">
            <Logo /> <span className="brand-word">Emberly</span>
          </Link>
          <NavLinks variant="top" />
          <div className="topbar-right">
            <ThemeToggle />
            <Suspense fallback={<span className="avatar-btn skeleton" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main id="main" className="main">
        {children}
      </main>
      <NavLinks variant="bottom" />
    </div>
  );
}
