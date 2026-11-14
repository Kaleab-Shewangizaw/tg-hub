import Link from 'next/link';
import { Logo } from '@/components/icons';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="auth">
      <div className="auth-box rise">
        <Link href="/" className="brand" aria-label="Emberly home">
          <Logo /> Emberly
        </Link>
        <div className="auth-card">{children}</div>
      </div>
    </main>
  );
}
