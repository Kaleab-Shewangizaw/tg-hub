import Link from 'next/link';
import { Logo } from '@/components/icons';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="auth">
      <div className="auth-box rise">
        <Link href="/" className="brand" aria-label="Tally home">
          <Logo /> Tally
        </Link>
        <div className="auth-card">{children}</div>
      </div>
    </main>
  );
}
