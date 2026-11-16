import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MedalCards } from '@/components/MedalCards';
import { PanelSkeleton } from '@/components/Skeletons';
import { requireUser } from '@/server/auth';
import { loadDashboard } from '@/server/dashboard';

export const metadata: Metadata = { title: 'Medals' };

export default function MedalsPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Medals />
    </Suspense>
  );
}

async function Medals() {
  const user = await requireUser();
  const { dashboard } = loadDashboard(user);
  const earned = dashboard.medals.filter((m) => m.earned).length;
  return (
    <>
      <div className="page-head rise">
        <div>
          <h1>Medals</h1>
          <p className="page-head-desc">
            {earned ? `${earned} earned. ` : ''}Earned from real reactions and stars. Higher tiers change the metal and add ×2, ×3, ×4.
          </p>
        </div>
      </div>
      <MedalCards medals={dashboard.medals} />
    </>
  );
}
