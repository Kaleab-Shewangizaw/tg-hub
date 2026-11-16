import Link from 'next/link';
import { formatShortDate } from '@emberly/core';
import type { PublicProfile } from '@/server/profile';
import { ActivityGrid } from './ActivityGrid';
import { Avatar } from './Avatar';
import { IconCalendar, IconFlame, IconLock, IconStar, IconTelegram, IconUsers } from './icons';
import { MedalArt } from './MedalArt';
import { FollowButton, StarButton } from './SocialButtons';
import { YearList } from './YearList';

export const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

export function ProfileView({ p, signedIn }: { p: PublicProfile; signedIn: boolean }) {
  const d = p.dashboard;
  const unit = d.streaks.unit === 'week' ? 'week' : 'day';
  const earned = d.medals.filter((m) => m.earned);
  const joined = monthYear(p.joinedAt);

  return (
    <div className="profile">
      <aside className="profile-side" aria-label="About">
        <Avatar name={p.name} seed={p.handle} size={112} className="profile-avatar" />
        <div className="profile-names">
          <h1>{p.name}</h1>
          <p>@{p.handle}</p>
        </div>
        {p.bio ? <p className="profile-bio">{p.bio}</p> : null}
        <div className="profile-cta">
          {p.isOwner ? (
            <Link href="/app/settings#profile" className="btn btn-ghost">
              Edit profile
            </Link>
          ) : (
            <FollowButton handle={p.handle} following={p.viewerFollows} signedIn={signedIn} />
          )}
        </div>
        <ul className="profile-meta">
          <li>
            <IconUsers size={15} />
            <Link href={`/u/${p.handle}/followers`}>
              <strong>{p.followers.toLocaleString('en-US')}</strong> {p.followers === 1 ? 'follower' : 'followers'}
            </Link>
            <span aria-hidden>·</span>
            <Link href={`/u/${p.handle}/following`}>
              <strong>{p.following.toLocaleString('en-US')}</strong> following
            </Link>
          </li>
          <li>
            <IconStar size={15} /> <span>{plural(p.stars, 'star')} on channels</span>
          </li>
          {p.creatorSince ? (
            <li>
              <IconTelegram size={15} /> <span>Creator since {monthYear(p.creatorSince)}</span>
            </li>
          ) : null}
          <li>
            <IconCalendar size={15} /> <span>Joined Tally {joined}</span>
          </li>
        </ul>
      </aside>

      <div className="profile-main">
        {p.isOwner && !p.isPublic ? (
          <p className="banner">
            <IconLock size={16} /> Your profile is private. Only you can see this page.
            <Link href="/app/settings#profile">Change</Link>
          </p>
        ) : null}

        <dl className="profile-stats">
          <div className="pstat is-streak">
            <dt>
              <IconFlame size={14} /> Current streak
            </dt>
            <dd>
              {d.streaks.current}
              <span>{d.streaks.current === 1 ? unit : `${unit}s`}</span>
            </dd>
          </div>
          <div className="pstat">
            <dt>Best streak</dt>
            <dd>
              {d.streaks.best}
              <span>{d.streaks.best === 1 ? unit : `${unit}s`}</span>
            </dd>
          </div>
          <div className="pstat">
            <dt>Posts</dt>
            <dd>{d.totals.posts.toLocaleString('en-US')}</dd>
          </div>
          <div className="pstat">
            <dt>Medals</dt>
            <dd>
              {earned.length}
            </dd>
          </div>
        </dl>

        <section className="panel" aria-labelledby="pch">
          <div className="panel-head">
            <h2 id="pch" className="panel-title">
              Channels {p.channels.length > 1 ? <span className="panel-count mono">{p.channels.length}</span> : null}
            </h2>
            {p.channels.length > 0 ? (
              <Link href={`/u/${p.handle}/channels`} className="link-arrow">
                All channels →
              </Link>
            ) : null}
          </div>
          {p.channels.length === 0 ? (
            <p className="empty small">No channels connected yet.</p>
          ) : (
            <ul className="pchannels">
              {p.channels.map((c) => (
                <li key={c.id}>
                  <span className="pchannel-icon">
                    <IconTelegram size={16} />
                  </span>
                  <div className="pchannel-text">
                    {c.handle ? (
                      <a href={`https://t.me/${c.handle}`} target="_blank" rel="noreferrer" className="pchannel-title">
                        {c.title}
                      </a>
                    ) : (
                      <span className="pchannel-title">{c.title}</span>
                    )}
                    <span className="faint small">
                      {c.handle ? `@${c.handle}` : 'Private channel'}
                      {c.memberCount != null ? ` · ${plural(c.memberCount, 'subscriber')}` : ''} · since {monthYear(c.since)}
                    </span>
                  </div>
                  <StarButton channelId={c.id} starred={c.starredByViewer} count={c.stars} signedIn={signedIn} disabled={p.isOwner} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="pact">
          <div className="panel-head">
            <h2 id="pact" className="panel-title">
              {plural(d.grid.totals.posts, 'post')} {d.grid.year ? `in ${d.grid.year}` : 'in the last year'}
            </h2>
            <span className="panel-sub">Tracking since {formatShortDate(d.trackingStart)}</span>
          </div>
          <div className="ag-with-years">
            <ActivityGrid key={d.grid.range.start} grid={d.grid} dayPosts={d.dayPosts} weekGoals={d.weekGoals} today={d.today} />
            <YearList years={d.years} active={d.grid.year} href={`/u/${p.handle}`} />
          </div>
        </section>

        {earned.length > 0 ? (
        <section className="panel" aria-labelledby="pmed">
          <div className="panel-head">
            <h2 id="pmed" className="panel-title">
              Achievements <span className="panel-count mono">{earned.length}</span>
            </h2>
          </div>
          <ul className="coin-row">
            {earned.map((m) => (
              <li key={m.id} title={`${m.name}${m.tier > 1 ? ` ×${m.tier}` : ''}: ${m.because ?? m.rule}`}>
                <MedalArt mark={m.mark} tier={m.tier} size={64} />
                <span className="medal-cap">{m.name}</span>
              </li>
            ))}
          </ul>
        </section>
        ) : null}
      </div>
    </div>
  );
}
