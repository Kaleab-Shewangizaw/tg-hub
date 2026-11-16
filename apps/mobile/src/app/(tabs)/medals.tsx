import { formatShortDate } from '@emberly/core';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedalBadge } from '@/components/MedalBadge';
import { ErrorState, LoadingState } from '@/components/States';
import { Card, ProgressBar, Txt } from '@/components/ui';
import { useDashboardContext } from '@/lib/DashboardContext';
import { useTheme } from '@/lib/theme';

export default function Medals() {
  const t = useTheme();
  const { state, reload } = useDashboardContext();
  if (state.kind === 'loading') return <LoadingState />;
  if (state.kind === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Txt tone="display" accessibilityRole="header">
          Medals
        </Txt>
        <Txt tone="muted">Earned from real reactions and stars. Higher tiers change the metal and add ×2, ×3, ×4.</Txt>
        {state.data.dashboard.medals.filter((m) => m.earned).length === 0 ? (
          <Card>
            <Txt tone="small">No medals yet. Your first comes at 100 reactions on a single post.</Txt>
          </Card>
        ) : null}
        {state.data.dashboard.medals.filter((m) => m.earned).map((m) => (
          <Card key={m.id} accessible accessibilityLabel={`${m.name}. ${m.earned ? `Earned ${m.earnedOn}. ${m.because}` : 'Not yet earned.'} ${m.rule}`}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <MedalBadge mark={m.mark} tier={m.tier} />
              <View style={{ flex: 1 }}>
                <Txt tone="title">
                  {m.name}
                  {m.tier > 1 ? <Txt tone="small"> ×{m.tier}</Txt> : null}
                </Txt>
                <Txt tone="small">{m.earnedOn ? `Earned ${formatShortDate(m.earnedOn)}` : 'Earned'}</Txt>
              </View>
            </View>
            <Txt tone="small">{m.rule}</Txt>
            {m.because ? (
              <View style={{ backgroundColor: t.sageSoft, borderRadius: 10, padding: 10 }}>
                <Txt tone="small" style={{ color: t.ink }}>
                  {m.because}
                </Txt>
              </View>
            ) : null}
            {m.next ? (
              <View style={{ gap: 6 }}>
                <Txt tone="small">
                  Next: {m.next.label} ({Math.min(m.next.current, m.next.target)} of {m.next.target})
                </Txt>
                <ProgressBar value={m.next.current} max={m.next.target} />
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
