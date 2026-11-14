import { describeCadence, WEEKDAY_SHORT } from '@emberly/core';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorState, LoadingState } from '@/components/States';
import { Button, Card, Notice, Pill, Txt } from '@/components/ui';
import { api, API_URL } from '@/lib/api';
import { useDashboardContext } from '@/lib/DashboardContext';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const STATUS = {
  active: { label: 'Tracking', tone: 'sage' },
  pending: { label: 'Setup in progress', tone: 'amber' },
  needs_attention: { label: 'Needs attention', tone: 'amber' },
  disconnected: { label: 'Not tracking', tone: 'neutral' },
} as const;

export default function Settings() {
  const t = useTheme();
  const session = useSession();
  const { state, reload, setData } = useDashboardContext();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.kind === 'loading') return <LoadingState />;
  if (state.kind === 'error') return <ErrorState message={state.message} onRetry={reload} />;
  const { data, demo } = state;
  const s = data.settings;
  const r = s.reminders;

  const toggleReminders = async (enabled: boolean) => {
    const next = { ...s, reminders: { ...r, enabled } };
    if (demo) {
      setData({ ...data, settings: next });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.saveSettings(session.token!, next);
      setData({ ...data, settings: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save.');
    } finally {
      setSaving(false);
    }
  };

  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => r.days.includes(d as never)).map((d) => WEEKDAY_SHORT[d]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Txt tone="display" accessibilityRole="header">
          Rhythm
        </Txt>

        <Card>
          <Txt tone="eyebrow">Your goal</Txt>
          <Txt tone="title">{describeCadence(s.cadence)}</Txt>
          <Txt tone="small">
            Time zone {s.timeZone.replaceAll('_', ' ')} · weeks start {s.weekStartsOn === 1 ? 'Monday' : 'Sunday'}
            {s.pauses.length ? ` · ${s.pauses.length} planned break${s.pauses.length === 1 ? '' : 's'}` : ''}
          </Txt>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Txt tone="title">Gentle reminders</Txt>
              <Txt tone="small">
                {r.enabled ? `After ${r.time} on ${days.join(', ') || 'no days'}${r.quietHours ? `, quiet ${r.quietHours.start}–${r.quietHours.end}` : ''}` : 'Off'}
              </Txt>
            </View>
            <Switch
              value={r.enabled}
              onValueChange={toggleReminders}
              disabled={saving}
              trackColor={{ true: t.sage, false: t.lineStrong }}
              accessibilityLabel="Gentle reminders"
            />
          </View>
          <Txt tone="small">One Telegram message at most per day, only if your goal isn’t met. Never on rest days, during breaks or in quiet hours.</Txt>
          {!demo && !data.user.telegramLinked && data.mode === 'live' ? <Notice tone="amber">Link your Telegram account on the web so the bot can message you.</Notice> : null}
          {error ? (
            <Txt tone="small" accessibilityRole="alert" style={{ color: t.amber, fontWeight: '600' }}>
              {error}
            </Txt>
          ) : null}
        </Card>

        <Card>
          <Txt tone="title">Channels</Txt>
          {data.channels.length === 0 ? <Txt tone="muted">No channels connected yet.</Txt> : null}
          {data.channels.map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Txt style={{ flex: 1, fontWeight: '600' }}>{c.title}</Txt>
              <Pill label={STATUS[c.status].label} tone={STATUS[c.status].tone} />
              {c.source !== 'live' ? <Pill label={c.source === 'demo' ? 'Demo' : c.source === 'import' ? 'Imported' : 'Simulated'} tone="dusk" /> : null}
            </View>
          ))}
          {!demo ? <Button kind="quiet" title="Edit goal, breaks & channels on the web" onPress={() => Linking.openURL(`${API_URL}/app/settings`)} /> : null}
        </Card>

        <Button kind="quiet" title={demo ? 'Leave the demo' : 'Sign out'} onPress={session.signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
