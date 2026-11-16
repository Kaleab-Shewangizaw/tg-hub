import { SiteShell } from '@/components/SiteShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
