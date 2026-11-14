import { formatShortDate, type Post } from '@emberly/core';
import * as Linking from 'expo-linking';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityGrid } from '@/components/ActivityGrid';
import { ErrorState, LoadingState } from '@/components/States';
import { Button, Card, Notice, Pill, ProgressBar, Txt } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { useDashboardContext } from '@/lib/DashboardContext';
import { useTheme } from '@/lib/theme';

const timeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function PostRow({ post }: { post: Post }) {
  const t = useTheme();
  const r = post.metrics.reactions;
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt numberOfLines={2}>{post.textPreview ?? `(${post.kind})`}</Txt>
        <Txt tone="small">
          {timeFmt.format(new Date(post.publishedAt))}
          {post.source !== 'live' ? ` · ${post.source}` : ''}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Txt style={{ fontWeight: '700', fontSize: 14, color: r ? t.ink : t.ink3 }}>{r ? `${r.value} reactions` : 'No data yet'}</Txt>
        {r?.breakdown?.length ? <Txt tone="small">{r.breakdown.slice(0, 3).map((b) => `${b.label} ${b.count}`).join(' ')}</Txt> : null}
      </View>
    </View>
  );
}

export default function Today() {
  const t = useTheme();
  const { state, reload } = useDashboardContext();

  if (state.kind === 'loading') return <LoadingState />;
  if (state.kind === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { data, demo } = state;
  const d = data.dashboard;
  const p = d.progress;
  const calm = p.state === 'rest' || p.state === 'paused';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={reload} tintColor={t.accent} />}>
        <View>
          <Txt tone="eyebrow">{demo ? 'Demo' : p.unit === 'week' ? 'This week' : 'Today'}</Txt>
          <Txt tone="display" accessibilityRole="header">
            Hi {data.user.name.split(' ')[0]}.
          </Txt>
        </View>

        {demo ? <Notice>You’re looking at demo data from a made-up channel, “Field Notes”. Nothing here is real analytics.</Notice> : null}
        {!demo && data.mode === 'development' && data.hasSimulatedData ? <Notice>Development mode: channels and posts come from the simulator.</Notice> : null}

        {!demo && data.channels.length === 0 ? (
          <Card>
            <Txt tone="title">Connect your first channel</Txt>
            <Txt tone="muted">Setup happens on the web: link your Telegram account and add our bot to your channel as an admin. It takes about two minutes.</Txt>
            <Button title="Open setup on the web" onPress={() => Linking.openURL(`${API_URL}/app/channels`)} />
          </Card>
        ) : null}

        <Card style={{ backgroundColor: p.state === 'met' ? t.sageSoft : calm ? t.duskSoft : t.surface }}>
          <Txt tone="title" style={{ fontSize: 21, lineHeight: 27 }}>
            {p.headline}
          </Txt>
          <Txt tone="muted">{p.detail}</Txt>
          {!calm ? <ProgressBar value={p.posted} max={p.target} color={p.state === 'met' ? t.sage : t.accent} /> : null}
          <Txt tone="small">Your goal: {d.goalLabel}</Txt>
        </Card>

        <Card style={{ flexDirection: 'row', gap: 24 }}>
          <View>
            <Txt style={{ fontSize: 34, fontWeight: '700', color: t.accentInk }}>{d.streaks.current}</Txt>
            <Txt tone="small">current run</Txt>
          </View>
          <View>
            <Txt style={{ fontSize: 34, fontWeight: '700', color: t.ink2 }}>{d.streaks.best}</Txt>
            <Txt tone="small">best run</Txt>
          </View>
          <Txt tone="small" style={{ flex: 1, alignSelf: 'center' }}>
            {d.streaks.message}
          </Txt>
        </Card>

        <Card>
          <Txt tone="title">Your year of posting</Txt>
          <Txt tone="small">
            {d.grid.totals.posts} posts on {d.grid.totals.activeDays} days · since {formatShortDate(d.trackingStart)}
          </Txt>
          <ActivityGrid grid={d.grid} dayPosts={d.dayPosts} today={d.today} />
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt tone="title">Recent posts</Txt>
            {data.channels[0] ? <Pill label={data.channels[0].status === 'active' ? 'Tracking' : 'Check setup'} tone={data.channels[0].status === 'active' ? 'sage' : 'amber'} /> : null}
          </View>
          {d.recentPosts.length === 0 ? <Txt tone="muted">Your posts will appear here a moment after you publish them.</Txt> : null}
          {d.recentPosts.slice(0, 8).map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
          <Txt tone="small">Telegram’s Bot API shares reaction counts only. Views, forwards and comments aren’t available, so we don’t show them.</Txt>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
