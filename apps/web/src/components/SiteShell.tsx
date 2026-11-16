import Link from 'next/link';
import { Suspense } from 'react';
import { signOutAction } from '@/app/actions/auth';
import { currentUser, isAdmin } from '@/server/auth';
import type { UserRecord } from '@/server/repo';
import { Avatar } from './Avatar';
import { IconLogout, IconShield, IconSliders, IconUser, Logo } from './icons';
import { NavLinks } from './NavLinks';
import { ThemeToggle } from './ThemeToggle';

/**
 * Page chrome shared by the signed-in app and public pages (profiles,
 * explore). Signed-in visitors get the app navigation and account menu;
 * everyone else gets Sign in / Get started.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Suspense fallback={<HeaderFallback />}>
            <HeaderSession />
          </Suspense>
        </div>
      </header>
      <main id="main" className="main">
        {children}
      </main>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}

function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="brand" aria-label="Tally">
      <Logo /> <span className="brand-word">Tally</span>
    </Link>
  );
}

function HeaderFallback() {
  return (
    <>
      <Brand href="/" />
      <div className="topbar-right">
        <span className="avatar-btn skeleton" />
      </div>
    </>
  );
}

async function HeaderSession() {
  const user = await currentUser();
  if (!user) {
    return (
      <>
        <Brand href="/" />
        <div className="topbar-right">
          <ThemeToggle />
          <Link href="/sign-in" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
          <Link href="/sign-up" className="btn btn-sm">
            Get started
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      <Brand href="/app" />
      <NavLinks variant="top" />
      <div className="topbar-right">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </>
  );
}

async function BottomNav() {
  const user = await currentUser();
  return user ? <NavLinks variant="bottom" /> : null;
}

function UserMenu({ user }: { user: UserRecord }) {
  return (
    <details className="menu">
      <summary className="avatar-summary" aria-label={`Account menu for ${user.name}`} title={user.name}>
        <Avatar name={user.name} seed={user.handle} size={30} />
      </summary>
      <div className="menu-pop">
        <div className="menu-who">
          <p className="menu-name">{user.name}</p>
          <p className="faint small">@{user.handle}</p>
        </div>
        <Link href={`/u/${user.handle}`} className="menu-item">
          <IconUser size={16} /> Your profile
        </Link>
        <Link href="/app/settings" className="menu-item">
          <IconSliders size={16} /> Settings
        </Link>
        {isAdmin(user) ? (
          <Link href="/admin" className="menu-item">
            <IconShield size={16} /> Admin
          </Link>
        ) : null}
        <form action={signOutAction}>
          <button type="submit" className="menu-item">
            <IconLogout size={16} /> Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
