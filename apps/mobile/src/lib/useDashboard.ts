import { buildDashboard, generateDemoData, type DashboardResponse } from '@emberly/core';
import { TELEGRAM_CAPABILITIES } from '@emberly/telegram';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { useSession } from './session';

/** Demo data is generated on-device in the viewer's time zone and labelled as demo. */
function demoResponse(): DashboardResponse {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const demo = generateDemoData(now, tz);
  return {
    user: { name: 'Demo creator', telegramLinked: true },
    mode: 'development',
    channels: [demo.channel],
    capabilities: TELEGRAM_CAPABILITIES,
    dashboard: buildDashboard({ posts: demo.posts, channels: [demo.channel], schedule: demo.schedule, now }),
    settings: { ...demo.schedule, reminders: demo.reminders },
    hasSimulatedData: true,
  };
}

export type DashboardState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: DashboardResponse; demo: boolean; refreshing: boolean };

export function useDashboard() {
  const { status, token, signOut } = useSession();
  const [state, setState] = useState<DashboardState>({ kind: 'loading' });

  const load = useCallback(
    async (refreshing = false) => {
      if (status === 'demo') {
        setState({ kind: 'ready', data: demoResponse(), demo: true, refreshing: false });
        return;
      }
      if (!token) return;
      setState((s) => (s.kind === 'ready' ? { ...s, refreshing } : { kind: 'loading' }));
      try {
        const data = await api.dashboard(token);
        setState({ kind: 'ready', data, demo: false, refreshing: false });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await signOut();
          return;
        }
        setState({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
      }
    },
    [status, token, signOut],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const setData = useCallback((data: DashboardResponse) => setState((s) => (s.kind === 'ready' ? { ...s, data } : s)), []);
  return { state, reload: () => load(true), setData };
}
