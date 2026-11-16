import type { Metadata } from 'next';
import { Suspense } from 'react';
import { simulateAddChannelAction, simulatePostAction, simulateReactionsAction, unlinkTelegramAction } from '@/app/actions/channels';
import { ImportForm, LinkTelegram, RemoveChannelButton, VerifyChannelForm } from '@/components/ChannelForms';
import { ChannelStatusChip, SourceChip } from '@/components/ChannelStatus';
import { IconCheck, IconHeart, IconX } from '@/components/icons';
import { PanelSkeleton } from '@/components/Skeletons';
import { requireUser } from '@/server/auth';
import { telegramMode } from '@/server/botSettings';
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
            <div className="step-linked">
              Linked as <strong>{user.telegramName}</strong>
              <form action={unlinkTelegramAction}>
                <button type="submit" className="btn-text btn-quiet small">
                  Unlink
                </button>
              </form>
            </div>
          ) : (
            <>
              <p>This confirms it’s you and lets the bot send your reminders.</p>
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
              <p>In your channel: Administrators → Add admin. You can turn every permission off. The bot only reads.</p>
              {mode === 'development' && linked ? (
                <form action={simulateAddChannelAction} className="row-form">
                  <label htmlFor="sim-title" className="sr-only">
                    Channel name
                  </label>
                  <input id="sim-title" name="title" className="input" placeholder="Channel name" defaultValue="My channel" />
                  <button className="btn btn-accent" type="submit">
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
          <h3>Confirm the connection</h3>
          {!connected ? (
            mode === 'live' ? (
              <>
                <p>It usually connects on its own. You can also check by username:</p>
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
          <h1>Channels</h1>
          <p className="page-head-desc">
            {channels.length === 0 ? 'Connect a Telegram channel to start tracking.' : `${channels.length} channel${channels.length === 1 ? '' : 's'} connected.`}
          </p>
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
                    <button className="btn" type="submit">
                      Publish
                    </button>
                  </form>
                  <form action={simulateReactionsAction}>
                    <input type="hidden" name="channelId" value={c.id} />
                    <button className="btn btn-ghost btn-sm" type="submit" style={{ justifySelf: 'start' }}>
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
            <details className="panel disclosure">
              <summary className="panel-title">Connect another channel</summary>
              <div className="disclosure-body">{setup}</div>
            </details>
          ) : (
            <section className="panel" aria-label="Setup">
              <div className="panel-head">
                <h2 className="panel-title">Connect a channel</h2>
                <span className="panel-sub">Step {step} of 3</span>
              </div>
              {setup}
            </section>
          )}
        </div>

        <div className="stack">
          <section className="panel" aria-labelledby="import-title">
            <h2 id="import-title" className="panel-title">
              Import past posts
            </h2>
            <p className="muted small" style={{ margin: '4px 0 14px' }}>
              The bot only sees posts made after it joins. Once your channel is verified, add older ones from an export of its history.
            </p>
            <details className="small" style={{ marginBottom: 14 }}>
              <summary className="btn-text small">How do I export?</summary>
              <ol className="howto" style={{ marginTop: 8 }}>
                <li>Telegram Desktop → your channel → ⋮ → Export chat history</li>
                <li>Untick media, choose “JSON”</li>
                <li>
                  Upload <span className="code">result.json</span>
                </li>
              </ol>
              <p className="muted" style={{ marginTop: 10 }}>
                No Telegram Desktop? Run <span className="code">scripts/telegram-history.py</span> on your computer. It signs in as you with Telethon and writes
                the same JSON file, including reactions.
              </p>
            </details>
            <ImportForm />
          </section>

          <section className="panel" aria-labelledby="tracked-title">
            <h2 id="tracked-title" className="panel-title" style={{ marginBottom: 12 }}>
              What’s tracked
            </h2>
            <ul className="track-list">
              <li>
                <IconCheck size={15} /> Every new post
              </li>
              <li>
                <IconCheck size={15} /> Reactions on posts
              </li>
              <li className="off" title="The Telegram Bot API doesn’t share views, forwards or comment counts.">
                <IconX size={15} /> Views, forwards and comments (not shared by Telegram)
              </li>
            </ul>
            <p className="faint small" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              Read-only. The bot never posts, edits or deletes anything.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
