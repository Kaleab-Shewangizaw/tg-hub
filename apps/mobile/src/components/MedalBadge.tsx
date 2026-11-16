import { Text, View } from 'react-native';

/** Tier metals, matching the web coins: ×1 steel blue, ×2 bronze, ×3 silver, ×4 gold. */
const METALS = [
  { rim: '#3e5f9c', face: '#7fa3e0', ink: '#1d3260', pill: '#2f6fe0' },
  { rim: '#7d441a', face: '#c9813f', ink: '#45230a', pill: '#b8692c' },
  { rim: '#858d9a', face: '#cdd3dc', ink: '#40464f', pill: '#8b94a3' },
  { rim: '#a2690a', face: '#ebb533', ink: '#573700', pill: '#d79e17' },
];

/** A coin with the medal's mark; tiers above ×1 change metal and show a ×N pill. */
export function MedalBadge({ mark, tier, size = 56 }: { mark: string; tier: number; size?: number }) {
  const m = METALS[Math.min(Math.max(tier, 1), 4) - 1]!;
  const isText = /^[0-9★+K]+$/.test(mark);
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: m.rim,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: 3,
          borderBottomColor: m.ink,
        }}
      >
        <View style={{ width: size * 0.78, height: size * 0.78, borderRadius: size, backgroundColor: m.face, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: m.ink, fontSize: size * (isText ? 0.26 : 0.36), fontWeight: '800' }}>{mark}</Text>
        </View>
      </View>
      {tier > 1 ? (
        <View style={{ position: 'absolute', right: -2, bottom: -2, backgroundColor: m.pill, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>×{tier}</Text>
        </View>
      ) : null}
    </View>
  );
}
