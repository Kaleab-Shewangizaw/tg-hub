'use client';

import { useEffect, useState } from 'react';
import { buildDashboard, generateDemoData, type DashboardModel } from '@emberly/core';
import { TELEGRAM_CAPABILITIES } from '@emberly/telegram';
import { DashboardView } from '@/components/Dashboard';
import { DashboardSkeleton } from '@/components/Skeletons';

/** Runs entirely in the browser, in the visitor's own time zone. */
export function DemoDashboard() {
  const [model, setModel] = useState<DashboardModel | null>(null);
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const now = new Date();
    const demo = generateDemoData(now, tz);
    setModel(buildDashboard({ posts: demo.posts, channels: [demo.channel], schedule: demo.schedule, now, year }));
  }, [year]);

  if (!model) return <DashboardSkeleton />;

  return (
    <>
      <div className="page-head rise">
        <div>
          <p className="eyebrow">Field Notes · sample channel</p>
          <h1>Overview</h1>
        </div>
        <div className="page-head-meta">
          <span className="chip chip-mint chip-dot">Tracking</span>
          <span className="chip">{model.goalLabel}</span>
        </div>
      </div>
      <DashboardView model={model} capabilities={TELEGRAM_CAPABILITIES} basePath={null} onYear={setYear} />
    </>
  );
}
