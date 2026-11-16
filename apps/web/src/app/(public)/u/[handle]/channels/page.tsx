import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Avatar } from '@/components/Avatar';
import { GridPreview } from '@/components/GridPreview';
import { IconTelegram } from '@/components/icons';
import { monthYear } from '@/components/ProfileView';
import { PanelSkeleton } from '@/components/Skeletons';
import { StarButton } from '@/components/SocialButtons';
import { currentUser } from '@/server/auth';
import { loadCreatorChannels } from '@/server/profile';
import * as repo from '@/server/repo';

export async function generateMetadata({ params }: PageProps<'/u/[handle]/channels'>): Promise<Metadata> {
  const { handle } = await params;
  const u = repo.getUserByHandle(decodeURIComponent(handle));
  if (!u?.profilePublic || u.suspendedAt) return { title: 'Channels' };
  return { title: `${u.name}’s channels`, description: `The Telegram channels ${u.name} tracks on Tally.` };
}

export default function CreatorChannelsPage({ params }: PageProps<'/u/[handle]/channels'>) {
  return (
    <Suspense fallback={<PanelSkeleton rows={2} />}>
      <Channels params={params} />
    </Suspense>
  );
}

const fmt = (n: number) => n.toLocaleString('en-US');

function lastPost(iso: string | null): string {
  if (!iso) return 'No posts yet';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? 'Posted today' : days === 1 ? 'Posted yesterday' : days < 30 ? `Posted ${days} days ago` : `Last post ${monthYear(iso)}`;
}

async function Channels({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const viewer = await currentUser();
  const data = loadCreatorChannels(decodeURIComponent(handle), viewer);
  if (!data) notFound();
  const { profile: p, channels } = data;

  return (
    <div className="creator-channels">
      <Link href={`/u/${p.handle}`} className="follows-who">
        <Avatar name={p.name} seed={p.handle} size={40} />
        <span>
          <strong>{p.name}</strong>
          <span className="faint small">@{p.handle}</span>
        </span>
      </Link>

      <div className="page-head">
        <div>
          <h1>Channels</h1>
          <p className="page-head-desc">
            {channels.length === 0
              ? `${p.name} hasn’t connected a channel yet.`
              : `${channels.length} ${channels.length === 1 ? 'channel' : 'channels'}${p.creatorSince ? ` · creator since ${monthYear(p.creatorSince)}` : ''}`}
          </p>
        </div>
      </div>

      <ul className="cc-list">
        {channels.map((c, i) => (
          <li key={c.id} className="cc-card" style={{ ['--i' as string]: i }}>
            <div className="cc-head">
              <span className="pchannel-icon">
                <IconTelegram size={18} />
              </span>
              <div className="cc-names">
                {c.handle ? (
                  <a href={`https://t.me/${c.handle}`} target="_blank" rel="noreferrer" className="cc-title">
                    {c.title}
                  </a>
                ) : (
                  <span className="cc-title">{c.title}</span>
                )}
                <span className="faint small">{c.handle ? `t.me/${c.handle}` : 'Private channel'}</span>
              </div>
              <StarButton channelId={c.id} starred={c.starredByViewer} count={c.stars} signedIn={!!viewer} disabled={p.isOwner} />
            </div>

            <dl className="cc-stats">
              <div>
                <dt>Since</dt>
                <dd>{monthYear(c.since)}</dd>
              </div>
              <div>
                <dt>Posts tracked</dt>
                <dd className="mono">{fmt(c.posts)}</dd>
              </div>
              <div>
                <dt>Subscribers</dt>
                <dd className="mono">{c.memberCount != null ? fmt(c.memberCount) : '—'}</dd>
              </div>
            </dl>

            <div className="cc-grid">
              <GridPreview grid={c.grid} weeks={26} />
            </div>
            <p className="faint small">{lastPost(c.lastPostAt)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
