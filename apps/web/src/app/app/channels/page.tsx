import type { Metadata } from 'next';
import { Suspense } from 'react';
import { simulateAddChannelAction, simulatePostAction, simulateReactionsAction, unlinkTelegramAction } from '@/app/actions/channels';
import { ImportForm, LinkTelegram, RemoveChannelButton, VerifyChannelForm } from '@/components/ChannelForms';
import { ChannelStatusChip, SourceChip } from '@/components/ChannelStatus';
import { IconCheck, IconHeart, IconX } from '@/components/icons';
import { PanelSkeleton } from '@/components/Skeletons';
import { requireUser } from '@/server/auth';
import { telegramMode } from '@/server/config';
import { telegramBotUsername } from '@/server/platforms';
import * as repo from '@/server/repo';

export const metadata: Metadata = { title: 'Channels' };

export default function ChannelsPage() {
  return (
    <Suspense fallback={<PanelSkeleton rows={2} />}>
      <Channels />
    </Suspense>
  );
}

function ago(iso: string | null) {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

async function Channels() {
  const user = await requireUser();
  const mode = telegramMode();
  const channels = repo.listChannels(user.id);
  const bot = mode === 'live' ? await telegramBotUsername() : 'emberly_bot';
  const botName = `@${bot ?? 'emberly_bot'}`;
  const linked = !!user.telegramUserId;
  const connected = channels.some((c) => c.status === 'active');
  const step = !linked ? 1 : !connected ? 2 : 3;

  const setup = (
    <ol className="steps-v">
      <li className={`step-v ${linked ? 'is-done' : 'is-current'}`}>
        <span className="step-mark">{linked ? <IconCheck size={16} /> : 1}</span>
        <div className="step-body">
          <h3>Link your Telegram</h3>
          {linked ? (
            <div className="small muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              Linked as <strong style={{ color: 'var(--ink)' }}>{user.telegramName}</strong>
              <form action={unlinkTelegramAction}>
                <button type="submit" className="btn-text small">
                  Unlink
                </button>
              </form>
            </div>
          ) : (
            <>
              <p>So we know it’s you, and where to send reminders.</p>
              <LinkTelegram mode={mode} linked={linked} />
            </>
          )}
        </div>
      </li>
      <li className={`step-v ${connected ? 'is-done' : step === 2 ? 'is-current' : ''}`}>
        <span className="step-mark">{connected ? <IconCheck size={16} /> : 2}</span>
        <div className="step-body">
          <h3>Add {botName} as an admin</h3>
          {!connected ? (
            <>
              <p>Channel → Administrators → Add admin. Turn every permission off; it only reads.</p>
              {mode === 'development' && linked ? (
                <form action={simulateAddChannelAction} className="row-form">
                  <label htmlFor="sim-title" className="sr-only">
                    Channel name
                  </label>
                  <input id="sim-title" name="title" className="input" placeholder="Channel name" defaultValue="My channel" />
                  <button className="btn btn-accent btn-sm" type="submit" style={{ height: 42 }}>
                    Simulate add
                  </button>
                </form>
              ) : null}
            </>
          ) : null}
        </div>
      </li>
      <li className={`step-v ${connected ? 'is-done' : ''}`}>
        <span className="step-mark">{connected ? <IconCheck size={16} /> : 3}</span>
        <div className="step-body">
          <h3>Confirm</h3>
          {!connected ? (
            mode === 'live' ? (
              <>
                <p>It connects on its own. Or check by username:</p>
                <VerifyChannelForm />
              </>
            ) : (
              <p>Simulated channels connect automatically.</p>
            )
          ) : null}
        </div>
      </li>
    </ol>
  );

  return (
    <>
      <div className="page-head rise">
        <div>
          <p className="eyebrow">{channels.length === 0 ? 'Not connected yet' : `${channels.length} channel${channels.length === 1 ? '' : 's'}`}</p>
          <h1>Channels</h1>
        </div>
        {mode === 'development' ? (
          <span className="chip chip-outline" title="No TELEGRAM_BOT_TOKEN set. Every step is simulated.">
            Development mode
          </span>
        ) : null}
      </div>

      <div className="cols">
        <div className="stack">
          {channels.map((c) => (
            <article key={c.id} className="panel ch-card" aria-labelledby={`ch-${c.id}`}>
              <div className="ch-head">
                <span className="avatar">{c.title.trim()[0]?.toUpperCase()}</span>
                <div style={{ minWidth: 0 }}>
                  <p className="ch-title" id={`ch-${c.id}`}>
                    {c.title}
                  </p>
                  <p className="faint small">{c.handle ? `@${c.handle}` : 'Private channel'}</p>
                </div>
                <ChannelStatusChip status={c.status} />
              </div>
              {c.statusDetail && c.status !== 'active' ? <p className="ch-detail">{c.statusDetail}</p> : null}
              <dl className="ch-stats" style={{ margin: 0 }}>
                <div>
                  <dt>Subscribers</dt>
                  <dd>{c.memberCount != null ? c.memberCount.toLocaleString('en-US') : '—'}</dd>
                </div>
                <div>
                  <dt>Last update</dt>
                  <dd>{ago(c.lastEventAt)}</dd>
                </div>
                <div>
                  <dt>Since</dt>
                  <dd>{new Date(c.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</dd>
                </div>
              </dl>
              {mode === 'development' && c.source === 'simulated' ? (
                <div className="sim">
                  <p className="sim-title">Simulator</p>
                  <form action={simulatePostAction} className="row-form">
                    <input type="hidden" name="channelId" value={c.id} />
                    <label htmlFor={`post-${c.id}`} className="sr-only">
                      Post text
                    </label>
                    <input id={`post-${c.id}`} name="text" className="input" placeholder="Write a post…" />
                    <button className="btn btn-sm" type="submit" style={{ height: 42 }}>
                      Publish
                    </button>
                  </form>
                  <form action={simulateReactionsAction}>
                    <input type="hidden" name="channelId" value={c.id} />
                    <button className="btn btn-ghost btn-sm" type="submit">
                      <IconHeart size={14} /> React to latest
                    </button>
                  </form>
                </div>
              ) : null}
              <div className="ch-actions">
                <SourceChip source={c.source} />
                <RemoveChannelButton channelId={c.id} title={c.title} />
              </div>
            </article>
          ))}

          {connected ? (
            <details className="panel">
              <summary className="panel-title" style={{ cursor: 'pointer' }}>
                Connect another channel
              </summary>
              <div style={{ marginTop: 20 }}>{setup}</div>
            </details>
          ) : (
            <section className="panel" aria-label="Setup">
              <div className="panel-head">
                <h2 className="panel-title">Connect a channel</h2>
                <span className="faint small">Step {step} of 3</span>
              </div>
              {setup}
            </section>
          )}
        </div>

        <div className="stack">
          <section className="panel" aria-labelledby="import-title">
            <div className="panel-head" style={{ marginBottom: 6 }}>
              <h2 id="import-title" className="panel-title">
                Import history
              </h2>
            </div>
            <p className="muted small" style={{ marginBottom: 14 }}>
              Bots can’t see older posts. Bring them in from a Telegram export.
            </p>
            <details className="small" style={{ marginBottom: 14 }}>
              <summary className="btn-text small" style={{ cursor: 'pointer' }}>
                How to export
              </summary>
              <ol className="muted" style={{ paddingLeft: 18, margin: '8px 0 0', display: 'grid', gap: 4 }}>
                <li>Telegram Desktop → your channel → ⋮ → Export chat history</li>
                <li>Untick media, choose “JSON”</li>
                <li>
                  Upload <span className="code">result.json</span>
                </li>
              </ol>
            </details>
            <ImportForm />
          </section>

          <section className="panel" aria-labelledby="tracked-title">
            <h2 id="tracked-title" className="panel-title" style={{ marginBottom: 14 }}>
              What’s tracked
            </h2>
            <div className="track-list">
              <span className="chip chip-mint">
                <IconCheck size={13} /> Posts
              </span>
              <span className="chip chip-mint">
                <IconCheck size={13} /> Reactions
              </span>
              <span className="chip chip-outline" title="The Telegram Bot API doesn’t share views, forwards or comment counts.">
                <IconX size={13} /> Views
              </span>
            </div>
            <p className="faint small" style={{ marginTop: 14 }}>
              Read-only. The bot never posts, edits or deletes.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
