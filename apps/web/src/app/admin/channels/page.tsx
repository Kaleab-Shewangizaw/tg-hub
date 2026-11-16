import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChannelsTable } from '@/components/admin/ChannelsTable';
import { fmt } from '@/components/admin/format';
import { PanelSkeleton } from '@/components/Skeletons';
import { requireAdmin } from '@/server/auth';
import * as repo from '@/server/repo';

export const metadata: Metadata = { title: 'Channels' };

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'active', label: 'Tracking' },
  { id: 'pending', label: 'Pending' },
  { id: 'needs_attention', label: 'Needs attention' },
  { id: 'disconnected', label: 'Disconnected' },
  { id: 'unclaimed', label: 'Unclaimed' },
];

type Search = { q?: string; status?: string };

export default function AdminChannelsPage({ searchParams }: PageProps<'/admin/channels'>) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Channels</h1>
          <p className="page-head-desc">Every connected channel, who owns it and whether it’s tracking.</p>
        </div>
      </div>
      <Suspense fallback={<PanelSkeleton rows={1} />}>
        <Channels searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function Channels({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 80) : '';
  const status = FILTERS.some((f) => f.id === sp.status) ? String(sp.status) : '';
  const channels = repo.adminListChannels({ q, status: status || undefined });
  const href = (s: string) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (s) p.set('status', s);
    const str = p.toString();
    return `/admin/channels${str ? `?${str}` : ''}`;
  };

  return (
    <div className="stack">
      <div className="adm-toolbar">
        <nav className="adm-filters" aria-label="Filter channels">
          {FILTERS.map((f) => (
            <Link key={f.id || 'all'} href={href(f.id)} aria-current={f.id === status ? 'true' : undefined}>
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="adm-search" action="/admin/channels" role="search">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input type="search" name="q" className="input" defaultValue={q} placeholder="Search title, handle or owner" aria-label="Search channels" />
          <button type="submit" className="btn btn-sm">
            Search
          </button>
        </form>
      </div>
      <section className="panel adm-table-panel">
        <p className="adm-count mono">
          {fmt(channels.length)} {channels.length === 1 ? 'channel' : 'channels'}
        </p>
        <ChannelsTable channels={channels} empty="No channels match." />
      </section>
    </div>
  );
}
