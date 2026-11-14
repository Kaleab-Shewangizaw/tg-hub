import * as SecureStore from 'expo-secure-store';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { api } from './api';

type Status = 'loading' | 'signedOut' | 'signedIn' | 'demo';

interface SessionValue {
  status: Status;
  token: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  startDemo(): void;
}

const KEY = 'emberly.session';
// SecureStore is native-only; the web build keeps the token in memory.
const store = {
  get: () => (Platform.OS === 'web' ? Promise.resolve(null) : SecureStore.getItemAsync(KEY)),
  set: (v: string) => (Platform.OS === 'web' ? Promise.resolve() : SecureStore.setItemAsync(KEY, v)),
  clear: () => (Platform.OS === 'web' ? Promise.resolve() : SecureStore.deleteItemAsync(KEY)),
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    store
      .get()
      .then((t) => {
        setToken(t);
        setStatus(t ? 'signedIn' : 'signedOut');
      })
      .catch(() => setStatus('signedOut'));
  }, []);

  const accept = useCallback(async (t: string) => {
    await store.set(t);
    setToken(t);
    setStatus('signedIn');
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      token,
      signIn: async (email, password) => accept((await api.signIn(email, password)).token),
      signUp: async (name, email, password) =>
        accept((await api.signUp(name, email, password, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')).token),
      signOut: async () => {
        if (token) await api.signOut(token).catch(() => undefined);
        await store.clear();
        setToken(null);
        setStatus('signedOut');
      },
      startDemo: () => setStatus('demo'),
    }),
    [status, token, accept],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const s = use(SessionContext);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
