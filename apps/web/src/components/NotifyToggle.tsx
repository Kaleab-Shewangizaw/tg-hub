'use client';

import { useOptimistic, useTransition } from 'react';
import { setNotifyMedalsAction } from '@/app/actions/settings';

export function MedalMessagesToggle({ on }: { on: boolean }) {
  const [shown, setShown] = useOptimistic(on);
  const [, start] = useTransition();
  return (
    <input
      type="checkbox"
      role="switch"
      className="switch"
      aria-label="Medal messages"
      checked={shown}
      onChange={(e) => {
        const next = e.target.checked;
        start(async () => {
          setShown(next);
          await setNotifyMedalsAction(next);
        });
      }}
    />
  );
}
