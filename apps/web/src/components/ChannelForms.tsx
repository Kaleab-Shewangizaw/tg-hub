'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  importExportAction,
  removeChannelAction,
  simulateLinkAction,
  startLinkAction,
  verifyChannelAction,
  type ImportState,
  type VerifyState,
} from '@/app/actions/channels';
import { IconCheck, IconCircle, IconTelegram, IconUpload } from './icons';

export function LinkTelegram({ mode, linked }: { mode: 'live' | 'development'; linked: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (mode === 'development') {
    return (
      <form action={simulateLinkAction}>
        <button className={`btn btn-sm ${linked ? 'btn-ghost' : 'btn-accent'}`} type="submit">
          <IconTelegram size={15} /> {linked ? 'Re-link (simulated)' : 'Simulate Start'}
        </button>
      </form>
    );
  }

  if (link) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <a className="btn btn-accent btn-sm" href={link} target="_blank" rel="noreferrer" style={{ justifySelf: 'start' }}>
          <IconTelegram size={15} /> Open Telegram
        </a>
        <p className="faint small">Press Start in the bot, then refresh this page. Link expires in 30 minutes.</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <button
        className={`btn btn-sm ${linked ? 'btn-ghost' : 'btn-accent'}`}
        style={{ justifySelf: 'start' }}
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const r = await startLinkAction();
              if (r.url) setLink(r.url);
              else setError('Bot username isn’t configured on the server.');
            } catch {
              setError('Couldn’t create a link. Try again.');
            }
          })
        }
      >
        <IconTelegram size={15} /> {pending ? 'Preparing…' : linked ? 'Link another account' : 'Link Telegram'}
      </button>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function VerifyChannelForm() {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyChannelAction, { result: null, error: null });
  return (
    <div className="stack" style={{ gap: 10 }}>
      <form action={action} className="row-form">
        <label htmlFor="channel" className="sr-only">
          Channel username
        </label>
        <input id="channel" name="channel" className="input" placeholder="@yourchannel" autoComplete="off" />
        <button className="btn btn-sm" type="submit" disabled={pending} style={{ height: 42 }}>
          {pending ? 'Checking…' : 'Check'}
        </button>
      </form>
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.result ? (
        <ul className="checks" aria-live="polite">
          {state.result.checks.map((c) => (
            <li key={c.label}>
              <span className={c.passed ? 'ok' : 'todo'}>{c.passed ? <IconCheck size={18} /> : <IconCircle size={18} />}</span>
              <span>
                {c.label}
                {!c.passed && c.help ? <span className="faint small" style={{ display: 'block' }}>{c.help}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importExportAction, { message: null, error: null });
  const [name, setName] = useState<string | null>(null);
  return (
    <form action={action} className="stack" style={{ gap: 10 }}>
      <label className="dropzone">
        <input name="export" type="file" accept="application/json,.json" className="sr-only" onChange={(e) => setName(e.target.files?.[0]?.name ?? null)} />
        <IconUpload size={20} />
        <span>{name ?? 'Choose result.json'}</span>
      </label>
      <button className="btn btn-sm" type="submit" disabled={pending || !name}>
        {pending ? 'Importing…' : 'Import'}
      </button>
      {state.message ? (
        <p className="banner banner-mint" role="status">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function RemoveChannelButton({ channelId, title }: { channelId: string; title: string }) {
  return (
    <form
      action={removeChannelAction}
      onSubmit={(e) => {
        if (!confirm(`Remove ${title} and its recorded posts from Emberly? This can’t be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="channelId" value={channelId} />
      <button className="btn-text small" type="submit" style={{ color: 'var(--ink-3)' }}>
        Remove
      </button>
    </form>
  );
}
