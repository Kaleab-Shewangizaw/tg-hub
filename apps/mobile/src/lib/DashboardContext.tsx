import { createContext, use } from 'react';
import { useDashboard } from './useDashboard';

type Value = ReturnType<typeof useDashboard>;
const Ctx = createContext<Value | null>(null);

/** One dashboard fetch shared by all tabs. */
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const value = useDashboard();
  return <Ctx value={value}>{children}</Ctx>;
}

export function useDashboardContext(): Value {
  const v = use(Ctx);
  if (!v) throw new Error('useDashboardContext must be used inside DashboardProvider');
  return v;
}
