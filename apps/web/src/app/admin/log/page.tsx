import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LogList } from '@/components/admin/LogList';
import { PanelSkeleton } from '@/components/Skeletons';
import { requireAdmin } from '@/server/auth';
import * as repo from '@/server/repo';

export const metadata: Metadata = { title: 'Audit log' };

export default function AdminLogPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Audit log</h1>
          <p className="page-head-desc">Every change an admin makes, newest first.</p>
        </div>
      </div>
      <Suspense fallback={<PanelSkeleton rows={1} />}>
        <Log />
      </Suspense>
    </>
  );
}

async function Log() {
  await requireAdmin();
  return (
    <section className="panel">
      <LogList entries={repo.listAdminLog({ limit: 200 })} />
    </section>
  );
}
