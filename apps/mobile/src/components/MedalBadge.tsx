import type { MedalId } from '@emberly/core';
import { Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

const GLYPH: Record<MedalId, string> = {
  'first-spark': '✦',
  'body-of-work': '❏',
  'kept-rhythm': '∿',
  'welcome-back': '↺',
  'crowd-favorite': '✿',
};

/** A simple rosette badge; locked medals are outlined so state never relies on color alone. */
export function MedalBadge({ id, earned, size = 52 }: { id: MedalId; earned: boolean; size?: number }) {
  const t = useTheme();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: earned ? t.grid[1] : 'transparent',
        borderWidth: earned ? 0 : 1.5,
        borderColor: t.lineStrong,
        borderStyle: earned ? 'solid' : 'dashed',
      }}
    >
      <View
        style={{
          width: size * 0.68,
          height: size * 0.68,
          borderRadius: size,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: earned ? t.grid[3] : t.surface2,
        }}
      >
        <Text style={{ color: earned ? t.surface : t.ink3, fontSize: size * 0.32, fontWeight: '700' }}>{GLYPH[id]}</Text>
      </View>
    </View>
  );
}
