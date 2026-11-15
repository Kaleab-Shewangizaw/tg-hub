import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/icons';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DemoDashboard } from './DemoDashboard';

export const metadata: Metadata = { title: 'Demo' };

export default function DemoPage() {
  return (
    <div className="shell">
      <div className="demo-bar">
        <span>You’re viewing a demo with sample data.</span>
        <Link href="/sign-up">Track your own channel →</Link>
      </div>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="Emberly home">
            <Logo /> <span className="brand-word">Emberly</span>
          </Link>
          <div className="topbar-right">
            <ThemeToggle />
            <Link href="/sign-in" className="btn btn-ghost btn-sm">
              Sign in
            </Link>
            <Link href="/sign-up" className="btn btn-sm">
              Get started
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="main">
        <DemoDashboard />
      </main>
    </div>
  );
}
