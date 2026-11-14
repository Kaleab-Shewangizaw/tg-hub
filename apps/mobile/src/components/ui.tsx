import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type TextProps, type ViewProps } from 'react-native';
import { serif, useTheme } from '@/lib/theme';

export function Card({ style, ...props }: ViewProps) {
  const t = useTheme();
  return <View {...props} style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }, style]} />;
}

type Tone = 'body' | 'muted' | 'title' | 'display' | 'eyebrow' | 'small';

export function Txt({ tone = 'body', style, ...props }: TextProps & { tone?: Tone }) {
  const t = useTheme();
  const toneStyle = {
    body: { color: t.ink, fontSize: 16, lineHeight: 23 },
    muted: { color: t.ink2, fontSize: 15, lineHeight: 22 },
    small: { color: t.ink2, fontSize: 13, lineHeight: 18 },
    title: { color: t.ink, fontSize: 18, fontFamily: serif, fontWeight: '600' as const },
    display: { color: t.ink, fontSize: 26, lineHeight: 32, fontFamily: serif, fontWeight: '600' as const },
    eyebrow: { color: t.ink2, fontSize: 12, fontWeight: '700' as const, letterSpacing: 1, textTransform: 'uppercase' as const },
  }[tone];
  return <Text {...props} style={[toneStyle, style]} />;
}

export function Button({ title, kind = 'primary', loading, style, ...props }: PressableProps & { title: string; kind?: 'primary' | 'quiet'; loading?: boolean }) {
  const t = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={(state) => [
        styles.button,
        { backgroundColor: primary ? t.accent : 'transparent', borderColor: primary ? t.accent : t.lineStrong, opacity: state.pressed || props.disabled ? 0.7 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? <ActivityIndicator color={primary ? t.onAccent : t.ink} /> : <Text style={{ color: primary ? t.onAccent : t.ink, fontWeight: '700', fontSize: 16 }}>{title}</Text>}
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'sage' | 'dusk' | 'amber' }) {
  const t = useTheme();
  const c = { neutral: [t.surface2, t.ink2], sage: [t.sageSoft, t.sage], dusk: [t.duskSoft, t.dusk], amber: [t.amberSoft, t.amber] }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c[0] }]}>
      <Text style={{ color: c[1], fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Notice({ children, tone = 'dusk' }: { children: React.ReactNode; tone?: 'dusk' | 'amber' | 'sage' }) {
  const t = useTheme();
  const bg = { dusk: t.duskSoft, amber: t.amberSoft, sage: t.sageSoft }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg, borderColor: tone === 'dusk' ? t.dusk : 'transparent' }]} accessibilityRole="summary">
      {typeof children === 'string' ? <Txt tone="small" style={{ color: t.ink }}>{children}</Txt> : children}
    </View>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const t = useTheme();
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={{ height: 10, borderRadius: 10, backgroundColor: t.surface2, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 10, backgroundColor: color ?? t.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, gap: 10 },
  button: { minHeight: 48, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  notice: { borderRadius: 12, padding: 12, borderWidth: 1, borderStyle: 'dashed' },
});
