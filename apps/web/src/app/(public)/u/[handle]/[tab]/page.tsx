import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Avatar } from '@/components/Avatar';
import { PeopleList } from '@/components/People';
import { PanelSkeleton } from '@/components/Skeletons';
import { currentUser } from '@/server/auth';
import * as repo from '@/server/repo';

export const metadata: Metadata = { title: 'Followers' };

export default function FollowsPage({ params }: PageProps<'/u/[handle]/[tab]'>) {
  return (
    <Suspense fallback={<PanelSkeleton rows={2} />}>
      <Follows params={params} />
    </Suspense>
  );
}

async function Follows({ params }: { params: Promise<{ handle: string; tab: string }> }) {
  const { handle, tab } = await params;
  if (tab !== 'followers' && tab !== 'following') notFound();
  const viewer = await currentUser();
  const owner = repo.getUserByHandle(decodeURIComponent(handle));
  if (!owner || ((!owner.profilePublic || owner.suspendedAt) && owner.id !== viewer?.id)) notFound();

  const people = tab === 'followers' ? repo.listFollowers(owner.id) : repo.listFollowing(owner.id);
  const followed = viewer ? repo.followedAmong(viewer.id, people.map((p) => p.id)) : new Set<string>();
  const counts = repo.followCounts(owner.id);

  return (
    <div className="narrow stack" style={{ gap: 20, width: '100%', margin: '0 auto' }}>
      <Link href={`/u/${owner.handle}`} className="follows-who">
        <Avatar name={owner.name} seed={owner.handle} size={40} />
        <span>
          <strong>{owner.name}</strong>
          <span className="faint small">@{owner.handle}</span>
        </span>
      </Link>
      <nav className="tabs" aria-label="Connections">
        <Link href={`/u/${owner.handle}/followers`} aria-current={tab === 'followers' ? 'page' : undefined}>
          Followers <span className="tab-count">{counts.followers}</span>
        </Link>
        <Link href={`/u/${owner.handle}/following`} aria-current={tab === 'following' ? 'page' : undefined}>
          Following <span className="tab-count">{counts.following}</span>
        </Link>
      </nav>
      <PeopleList
        people={people}
        followed={followed}
        viewerId={viewer?.id ?? null}
        empty={tab === 'followers' ? `No one follows ${owner.name} yet.` : `${owner.name} isn’t following anyone yet.`}
      />
    </div>
  );
}
