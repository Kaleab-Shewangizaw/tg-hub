'use client';

import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';
import { followAction, starAction } from '@/app/actions/social';
import { IconStar } from './icons';

/**
 * Follow and Star buttons. Both update instantly (optimistic) and settle on
 * the server's answer. Signed-out visitors get a link to sign in instead.
 */

export function FollowButton({ handle, following, signedIn, size = 'md' }: { handle: string; following: boolean; signedIn: boolean; size?: 'sm' | 'md' }) {
  const [shown, setShown] = useOptimistic(following);
  const [, start] = useTransition();
  const cls = `btn ${size === 'sm' ? 'btn-sm' : ''} ${shown ? 'btn-ghost is-following' : 'btn-accent'}`;
  if (!signedIn) {
    return (
      <Link href="/sign-in" className={`btn ${size === 'sm' ? 'btn-sm' : ''} btn-accent`}>
        Follow
      </Link>
    );
  }
  return (
    <form
      action={(fd) =>
        start(async () => {
          setShown(!shown);
          await followAction(fd);
        })
      }
    >
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="intent" value={shown ? 'unfollow' : 'follow'} />
      <button type="submit" className={cls} aria-pressed={shown}>
        {shown ? (
          <>
            <span className="when-idle">Following</span>
            <span className="when-hover">Unfollow</span>
          </>
        ) : (
          'Follow'
        )}
      </button>
    </form>
  );
}

export function StarButton({ channelId, starred, count, signedIn, disabled }: { channelId: string; starred: boolean; count: number; signedIn: boolean; disabled?: boolean }) {
  const [shown, setShown] = useOptimistic({ starred, count });
  const [, start] = useTransition();
  const inner = (
    <>
      <span className="star-main">
        <IconStar size={14} filled={shown.starred} /> {shown.starred ? 'Starred' : 'Star'}
      </span>
      <span className="star-count">{shown.count}</span>
    </>
  );
  if (disabled) {
    return (
      <span className="star-btn is-static" title="Stars from other creators">
        {inner}
      </span>
    );
  }
  if (!signedIn) {
    return (
      <Link href="/sign-in" className="star-btn">
        {inner}
      </Link>
    );
  }
  return (
    <form
      action={(fd) =>
        start(async () => {
          setShown({ starred: !shown.starred, count: shown.count + (shown.starred ? -1 : 1) });
          await starAction(fd);
        })
      }
    >
      <input type="hidden" name="channelId" value={channelId} />
      <input type="hidden" name="intent" value={shown.starred ? 'unstar' : 'star'} />
      <button type="submit" className={`star-btn ${shown.starred ? 'is-on' : ''}`} aria-pressed={shown.starred}>
        {inner}
      </button>
    </form>
  );
}
