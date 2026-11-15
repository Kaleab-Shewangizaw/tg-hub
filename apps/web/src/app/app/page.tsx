import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { formatLongDate, zonedParts } from '@emberly/core';
import { ChannelStatusChip } from '@/components/ChannelStatus';
import { DashboardView } from '@/components/Dashboard';
import { IconArrow, IconInfo, IconTelegram } from '@/components/icons';
import { DashboardSkeleton } from '@/components/Skeletons';
import { requireUser } from '@/server/auth';
import { loadDashboard } from '@/server/dashboard';

export const metadata: Metadata = { title: 'Overview' };

export default function OverviewPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Overview />
    </Suspense>
  );
}

function greeting(minutes: number) {
  if (minutes < 5 * 60) return 'Good night';
  if (minutes < 12 * 60) return 'Good morning';
  if (minutes < 18 * 60) return 'Good afternoon';
  return 'Good evening';
}

async function Overview() {
  const user = await requireUser();
  const data = loadDashboard(user);
  const { channels, dashboard } = data;
  const first = user.name.split(' ')[0];
  const { minutes } = zonedParts(new Date(), user.settings.timeZone);

  if (channels.length === 0) {
    return (
      <div className="onboard rise">
        <span className="onboard-icon">
          <IconTelegram size={22} />
        </span>
        <h1>Welcome, {first}</h1>
        <p className="muted">Connect your Telegram channel and Emberly will start mapping your posts. It takes about two minutes.</p>
        <div className="onboard-ctas">
          <Link href="/app/channels" className="btn btn-accent btn-lg">
            Connect a channel <IconArrow size={16} />
          </Link>
          <Link href="/demo" className="btn btn-ghost btn-lg">
            Explore the demo
          </Link>
        </div>
      </div>
    );
  }

  const attention = channels.find((c) => c.status === 'needs_attention' || c.status === 'pending');

  return (
    <>
      <div className="page-head rise">
        <div>
          <p className="eyebrow">{formatLongDate(dashboard.today).replace(/, \d{4}$/, '')}</p>
          <h1>
            {greeting(minutes)}, {first}
          </h1>
        </div>
        <div className="page-head-meta">
          {data.mode === 'development' ? (
            <Link href="/app/channels" className="chip chip-outline" title="No bot token configured. Data comes from the simulator.">
              Simulated
            </Link>
          ) : null}
          {channels.length === 1 ? (
            <Link href="/app/channels">
              <ChannelStatusChip status={channels[0]!.status} />
            </Link>
          ) : null}
          <Link href="/app/settings" className="chip" title="Change your goal">
            {dashboard.goalLabel}
          </Link>
        </div>
      </div>

      {attention ? (
        <p className="banner banner-amber" role="status">
          <IconInfo size={16} /> {attention.title} needs a quick look before it can track posts.
          <Link href="/app/channels">Check setup</Link>
        </p>
      ) : null}

      <DashboardView model={dashboard} capabilities={data.capabilities} basePath="/app" />
    </>
  );
}
