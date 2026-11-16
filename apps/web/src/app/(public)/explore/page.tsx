import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Avatar } from '@/components/Avatar';
import { GridPreview } from '@/components/GridPreview';
import { IconFlame } from '@/components/icons';
import { PanelSkeleton } from '@/components/Skeletons';
import { FollowButton } from '@/components/SocialButtons';
import { currentUser } from '@/server/auth';
import { loadExplore } from '@/server/profile';

export const metadata: Metadata = { title: 'Explore creators' };

export default function ExplorePage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Explore creators</h1>
          <p className="page-head-desc">Find Telegram creators to follow, and star the channels you love.</p>
        </div>
      </div>
      <Suspense fallback={<PanelSkeleton rows={2} />}>
        <Creators />
      </Suspense>
    </>
  );
}

async function Creators() {
  const viewer = await currentUser();
  const cards = loadExplore(viewer);
  if (cards.length === 0) {
    return (
      <div className="onboard">
        <h1>No public creators yet</h1>
        <p className="muted">Once creators connect a channel, they’ll show up here.</p>
      </div>
    );
  }
  return (
    <ul className="explore">
      {cards.map((c) => (
        <li key={c.id} className="xcard">
          <div className="xcard-top">
            <Avatar name={c.name} seed={c.handle} size={44} />
            <div className="xcard-names">
              <Link href={`/u/${c.handle}`} className="xcard-link">
                {c.name}
              </Link>
              <span className="faint small">@{c.handle}</span>
            </div>
            {c.isViewer ? <span className="chip">You</span> : <FollowButton handle={c.handle} following={c.viewerFollows} signedIn={!!viewer} size="sm" />}
          </div>
          {c.bio ? <p className="xcard-bio">{c.bio}</p> : null}
          <div className="xcard-grid">
            <GridPreview grid={c.grid} weeks={22} />
          </div>
          <p className="xcard-foot">
            {c.streak.current > 0 ? (
              <span className="xcard-streak">
                <IconFlame size={13} /> {c.streak.current} {c.streak.unit}
                {c.streak.current === 1 ? '' : 's'}
              </span>
            ) : null}
            <span>
              {c.followers} {c.followers === 1 ? 'follower' : 'followers'}
            </span>
            <span>{c.posts} posts</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
