import Link from 'next/link';
import type { ProfileSummary } from '@/server/repo';
import { Avatar } from './Avatar';
import { FollowButton } from './SocialButtons';

export function PeopleList({
  people,
  followed,
  viewerId,
  empty,
}: {
  people: ProfileSummary[];
  followed: Set<string>;
  viewerId: string | null;
  empty: string;
}) {
  if (people.length === 0) return <p className="empty">{empty}</p>;
  return (
    <ul className="people">
      {people.map((p) => (
        <li key={p.id}>
          <Avatar name={p.name} seed={p.handle} size={44} />
          <div className="people-text">
            <Link href={`/u/${p.handle}`} className="people-name">
              {p.name} <span className="faint">@{p.handle}</span>
            </Link>
            {p.bio ? <p className="people-bio">{p.bio}</p> : null}
            <p className="faint small">
              {p.followers} {p.followers === 1 ? 'follower' : 'followers'} · {p.posts} posts
            </p>
          </div>
          {p.id !== viewerId ? <FollowButton handle={p.handle} following={followed.has(p.id)} signedIn={!!viewerId} size="sm" /> : null}
        </li>
      ))}
    </ul>
  );
}
