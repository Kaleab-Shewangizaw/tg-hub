'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { runRemindersAction, saveBotTokenAction, sendTestAction, setDeliveryAction, type BotActionState } from '@/app/actions/bot';

const initial: BotActionState = { ok: false, message: null, error: null };

function Submit({ children, className = 'btn btn-sm', pending: label }: { children: React.ReactNode; className?: string; pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (label ?? 'Working…') : children}
    </button>
  );
}

function Result({ state }: { state: BotActionState }) {
  if (state.error)
    return (
      <p className="err small" role="alert">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p className="saved-note small" role="status">
        {state.message}
      </p>
    );
  return null;
}

export function TokenForm({ connected, locked }: { connected: boolean; locked: boolean }) {
  const [state, action] = useActionState(saveBotTokenAction, initial);
  return (
    <form action={action} className="adm-form">
      <div className="field">
        <label htmlFor="bot-token">{connected ? 'Replace bot token' : 'Bot token'}</label>
        <div className="row-form">
          <input
            id="bot-token"
            name="token"
            type="password"
            className="input mono"
            placeholder="123456789:AAH…"
            autoComplete="off"
            spellCheck={false}
            disabled={locked}
            required
          />
          <Submit pending="Checking…">{connected ? 'Replace' : 'Connect'}</Submit>
        </div>
      </div>
      <Result state={state} />
    </form>
  );
}

export function DeliveryForm({ current, httpsReady }: { current: 'polling' | 'webhook'; httpsReady: boolean }) {
  const [state, action] = useActionState(setDeliveryAction, initial);
  return (
    <form action={action} className="adm-form">
      <div className="delivery-options">
        <label className="delivery-option">
          <input type="radio" name="delivery" value="polling" defaultChecked={current === 'polling'} />
          <span>
            <strong>Polling</strong>
            <span className="small muted">This server asks Telegram for updates. Works anywhere, including your laptop.</span>
          </span>
        </label>
        <label className="delivery-option">
          <input type="radio" name="delivery" value="webhook" defaultChecked={current === 'webhook'} disabled={!httpsReady} />
          <span>
            <strong>Webhook</strong>
            <span className="small muted">{httpsReady ? 'Telegram calls this server. Best in production.' : 'Needs APP_URL set to a public https:// address.'}</span>
          </span>
        </label>
      </div>
      <div className="adm-form-foot">
        <Result state={state} />
        <Submit>Apply</Submit>
      </div>
    </form>
  );
}

export function TestMessageButton() {
  const [state, action] = useActionState(sendTestAction, initial);
  return (
    <form action={action} className="inline-action">
      <Submit className="btn btn-sm btn-ghost" pending="Sending…">
        Send me a test message
      </Submit>
      <Result state={state} />
    </form>
  );
}

export function RunRemindersButton() {
  const [state, action] = useActionState(runRemindersAction, initial);
  return (
    <form action={action} className="inline-action">
      <Submit className="btn btn-sm btn-ghost" pending="Running…">
        Run reminders now
      </Submit>
      <Result state={state} />
    </form>
  );
}
