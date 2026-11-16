import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/icons';
import { PanelSkeleton } from '@/components/Skeletons';
import { ThemeToggle } from '@/components/ThemeToggle';
import { requireAdmin } from '@/server/auth';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin · Tally' }, robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

/** Non-admins get a 404 before any admin chrome renders. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-top-inner">
          <Link href="/admin" className="brand" aria-label="Tally admin">
            <Logo /> Tally <span className="adm-badge mono">Admin</span>
          </Link>
          <AdminNav />
          <div className="topbar-right">
            <Link href="/app" className="btn btn-ghost btn-sm">
              Back to app
            </Link>
            <ThemeToggle />
            <Avatar name={admin.name} seed={admin.handle} size={30} />
          </div>
        </div>
      </header>
      <main id="main" className="adm-main">
        {children}
      </main>
    </div>
  );
}

function AdminFallback() {
  return (
    <div className="adm">
      <main className="adm-main">
        <PanelSkeleton rows={2} />
      </main>
    </div>
  );
}
