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
          <p className="eyebrow">
            {earned} of {dashboard.medals.length} earned
          </p>
          <h1>Medals</h1>
        </div>
      </div>
      <MedalCards medals={dashboard.medals} />
    </>
  );
}
