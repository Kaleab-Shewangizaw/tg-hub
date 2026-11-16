import { formatShortDate, type Channel, type DashboardModel, type MetricKey, type Post, type ProviderCapabilities } from '@emberly/core';
import { ActivityGrid, kindLabel } from './ActivityGrid';
import { IconFlame, IconHeart, IconInfo, IconLeaf, IconPause } from './icons';
import { YearList } from './YearList';

/**
 * Dashboard body. Pure presentation (no data access), shared by the signed-in
 * overview (server) and demo mode (client).
 */
export interface DashboardViewProps {
  model: DashboardModel;
  capabilities: ProviderCapabilities;
  /** Link prefix for "view all" links; demo passes null. */
  basePath: string | null;
  /** Client-only year switching (demo); server pages use ?year= links on basePath. */
  onYear?: (year: number | null) => void;
}

export function DashboardView({ model, capabilities, basePath, onYear }: DashboardViewProps) {
  return (
    <div className="dash">
      <GoalTile model={model} />
      <StreakTile model={model} />
      <ReactionsTile model={model} />

      <section className="panel dash-wide" aria-labelledby="activity-title">
        <div className="panel-head">
          <h2 className="panel-title" id="activity-title">
            Activity
          </h2>
          <p className="panel-sub">{activitySummary(model)}</p>
        </div>
        <div className="ag-with-years">
          <ActivityGrid key={model.grid.range.start} grid={model.grid} dayPosts={model.dayPosts} weekGoals={model.weekGoals} today={model.today} />
          <YearList years={model.years} active={model.grid.year} href={basePath ?? undefined} onSelect={onYear} />
        </div>
      </section>

      <RecentPosts posts={model.recentPosts} capabilities={capabilities} />
    </div>
  );
}

export function activitySummary(model: Pick<DashboardModel, 'grid' | 'trackingStart'>) {
  const n = model.grid.totals.posts;
  const posts = `${n.toLocaleString('en-US')} post${n === 1 ? '' : 's'}`;
  return model.grid.year ? `${posts} in ${model.grid.year}` : `${posts} in the last year`;
}

const GOAL_STATE: Record<DashboardModel['progress']['state'], { label: string; tone: string } | null> = {
  in_progress: null,
  met: { label: 'Goal met', tone: 'chip-mint' },
  rest: { label: 'Rest day', tone: 'chip-slate' },
  paused: { label: 'On a break', tone: 'chip-slate' },
};

function GoalTile({ model }: { model: DashboardModel }) {
  const p = model.progress;
  const calm = p.state === 'rest' || p.state === 'paused';
  const chip = GOAL_STATE[p.state];
  const when = p.unit === 'week' ? (p.daysLeft === 1 ? 'Last day' : `${p.daysLeft} days left`) : 'Today';
  return (
    <section className={`tile-goal is-${p.state}`} aria-labelledby="goal-title">
      <div className="tile-top">
        <h2 id="goal-title" className="tile-label">
          {p.unit === 'week' ? 'This week' : 'Today'}
        </h2>
        {chip ? <span className={`chip ${chip.tone}`}>{chip.label}</span> : null}
      </div>
      <p className="goal-headline">{p.headline}</p>
      {calm ? (
        <p className="goal-sub">
          <span>
            {p.state === 'paused' ? <IconPause size={14} /> : <IconLeaf size={14} />}{' '}
            {p.nextScheduledDay ? `Next goal day · ${formatShortDate(p.nextScheduledDay)}` : 'Enjoy the quiet'}
          </span>
        </p>
      ) : (
        <div className="goal-progress">
          {p.target <= 10 ? <Slots value={p.posted} max={p.target} /> : <Meter value={p.posted} max={p.target} label="Goal progress" />}
          <p className="goal-sub">
            <span>
              <span className="goal-count">{p.posted}</span> of {p.target} posts
            </span>
            <span>{when}</span>
          </p>
        </div>
      )}
    </section>
  );
}

function StreakTile({ model }: { model: DashboardModel }) {
  const s = model.streaks;
  const unit = s.unit === 'week' ? (s.current === 1 ? 'week' : 'weeks') : s.current === 1 ? 'day' : 'days';
  return (
    <section className={`tile-stat ${s.current > 0 ? 'is-hot' : ''}`} aria-label={`Current streak ${s.current} ${unit}, best ${s.best}`}>
      <p className="tile-label">
        <IconFlame size={15} /> Streak
      </p>
      <p className="big-num">
        {s.current}
        <span className="big-unit">{unit}</span>
      </p>
      <p className="faint small">Best: {s.best}</p>
    </section>
  );
}

function compact(n: number) {
  return n >= 10_000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function ReactionsTile({ model }: { model: DashboardModel }) {
  const t = model.totals;
  const has = t.postsWithReactions > 0;
  return (
    <section className="tile-stat" aria-label={has ? `${t.reactions} reactions recorded` : 'No reactions recorded yet'}>
      <p className="tile-label">
        <IconHeart size={15} /> Reactions
      </p>
      <p className="big-num">{has ? compact(t.reactions) : '—'}</p>
      <p className="faint small">{has ? `About ${Math.round(t.reactions / t.postsWithReactions)} per post` : 'None recorded yet'}</p>
    </section>
  );
}

const METRIC_LABEL: Record<MetricKey, string> = {
  reactions: 'Reactions',
  views: 'Views',
  forwards: 'Forwards',
  replies: 'Comments',
  likes: 'Likes',
  reposts: 'Reposts',
};

/** One-line note listing metrics the platform doesn't share; reasons on hover / focus. */
export function UnsupportedMetricsNote({ capabilities }: { capabilities: ProviderCapabilities }) {
  const missing = (Object.keys(capabilities.metrics) as MetricKey[]).filter((k) => !capabilities.metrics[k].supported && k !== 'likes' && k !== 'reposts');
  if (missing.length === 0) return null;
  const reasons = missing.map((k) => {
    const m = capabilities.metrics[k];
    return m.supported ? '' : m.reason;
  });
  return (
    <p className="metric-note" title={reasons.join(' ')}>
      <IconInfo size={14} /> {missing.map((k) => METRIC_LABEL[k]).join(', ')} aren’t shared by Telegram
    </p>
  );
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatShortDate(iso.slice(0, 10));
}

function RecentPosts({ posts, capabilities }: { posts: Post[]; capabilities: ProviderCapabilities }) {
  return (
    <section className="panel dash-wide" aria-labelledby="posts-title">
      <div className="panel-head">
        <h2 id="posts-title" className="panel-title">
          Recent posts
        </h2>
      </div>
      {posts.length === 0 ? (
        <div className="empty">
          <p>No posts yet</p>
          <p className="faint small">They’ll appear here moments after you publish.</p>
        </div>
      ) : (
        <ol className="posts">
          {posts.slice(0, 6).map((p) => {
            const r = p.metrics.reactions;
            const fresh = !r && Date.now() - Date.parse(p.publishedAt) < 3_600_000;
            const tip = r?.breakdown?.map((b) => `${b.label} ${b.count}`).join('  ');
            const body = (
              <>
                <span className="post-text">
                  <span className="post-preview">{p.textPreview ?? kindLabel(p.kind)}</span>
                  <span className="faint small" suppressHydrationWarning>
                    {ago(p.publishedAt)}
                    {p.source === 'import' ? ' · imported' : p.source === 'simulated' ? ' · simulated' : ''}
                  </span>
                </span>
                <span className={`post-react ${r ? '' : 'is-none'}`} title={tip}>
                  {r ? (
                    <>
                      <IconHeart size={14} /> {r.value}
                    </>
                  ) : fresh ? (
                    'pending'
                  ) : (
                    '—'
                  )}
                </span>
              </>
            );
            return (
              <li key={p.id}>
                {p.url ? (
                  <a className="post-row" href={p.url} target="_blank" rel="noreferrer">
                    {body}
                  </a>
                ) : (
                  <div className="post-row">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <UnsupportedMetricsNote capabilities={capabilities} />
    </section>
  );
}

/** One slot per post in the goal; filled slots are posts already made. */
function Slots({ value, max }: { value: number; max: number }) {
  return (
    <div className="slots" role="progressbar" aria-label="Goal progress" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? 'on' : ''} style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export type DashboardChannel = Pick<Channel, 'id' | 'title' | 'status' | 'source'>;
