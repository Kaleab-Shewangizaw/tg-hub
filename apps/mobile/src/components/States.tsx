import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { Button, Card, Txt } from './ui';

export function LoadingState({ label = 'Loading your rhythm…' }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: 40, alignItems: 'center', gap: 12 }} accessibilityLabel={label}>
      <ActivityIndicator color={t.accent} />
      <Txt tone="muted">{label}</Txt>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card style={{ margin: 16 }}>
      <Txt tone="title">This didn’t load</Txt>
      <Txt tone="muted">{message} Your data is safe.</Txt>
      <Button title="Try again" onPress={onRetry} />
    </Card>
  );
}
