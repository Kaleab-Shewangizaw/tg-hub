import { NativeTabs } from 'expo-router/native-tabs';
import { DashboardProvider } from '@/lib/DashboardContext';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <DashboardProvider>
      <NativeTabs backgroundColor={t.surface} indicatorColor={t.accentSoft} labelStyle={{ selected: { color: t.accentInk } }} tintColor={t.accent}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'flame', selected: 'flame.fill' }} md="local_fire_department" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="medals">
          <NativeTabs.Trigger.Label>Medals</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'rosette', selected: 'rosette' }} md="military_tech" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Rhythm</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'slider.horizontal.3', selected: 'slider.horizontal.3' }} md="tune" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </DashboardProvider>
  );
}
