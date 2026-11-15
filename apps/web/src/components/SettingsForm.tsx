'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { formatShortDate, WEEKDAY_SHORT, type Cadence, type SettingsInput, type Weekday } from '@emberly/core';
import { saveSettingsAction } from '@/app/actions/settings';
import { IconCheck, IconPlus, IconX } from './icons';

const DAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

function Days({ label, value, onChange }: { label: string; value: Weekday[]; onChange: (d: Weekday[]) => void }) {
  return (
    <fieldset className="days" aria-label={label}>
      {DAY_ORDER.map((d) => (
        <label key={d} title={WEEKDAY_SHORT[d]}>
          <input type="checkbox" checked={value.includes(d)} onChange={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])} aria-label={WEEKDAY_SHORT[d]} />
          <span aria-hidden>{WEEKDAY_SHORT[d][0]}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Fewer ${label}`} disabled={value <= min}>
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`More ${label}`} disabled={value >= max}>
        +
      </button>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [saved, setSaved] = useState<SettingsInput>(initial);
  const [s, setS] = useState<SettingsInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState({ start: '', end: '' });
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  const timeZones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [s.timeZone];
    }
  }, [s.timeZone]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const set = (patch: Partial<SettingsInput>) => {
    setError(null);
    setS((prev) => ({ ...prev, ...patch }));
  };
  const setCadence = (c: Cadence) => set({ cadence: c });
  const setRem = (patch: Partial<SettingsInput['reminders']>) => set({ reminders: { ...s.reminders, ...patch } });

  const perDay = s.cadence.kind === 'weekly' ? 1 : s.cadence.postsPerDay;
  const perWeek = s.cadence.kind === 'weekly' ? s.cadence.postsPerWeek : 3;
  const goalDays = s.cadence.kind === 'days' ? s.cadence.days : ([1, 3, 5] as Weekday[]);

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction(s);
      if (r.ok) {
        setSaved(s);
        setToast(true);
      } else setError(r.error);
    });

  return (
    <form
      className="settings"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section className="set-section" aria-labelledby="goal-h">
        <div className="set-section-head">
          <h2 id="goal-h" className="set-section-title">
            Your goal
          </h2>
          <p className="set-section-desc">How often you want to post. Streaks are counted in this rhythm.</p>
        </div>
        <div className="set-card">
        <div className="set-row">
          <div className="set-row-text">
            <span>Rhythm</span>
          </div>
          <fieldset className="seg" aria-label="Cadence">
            {(
              [
                ['weekly', 'Weekly'],
                ['days', 'Set days'],
                ['daily', 'Daily'],
              ] as const
            ).map(([kind, label]) => (
              <label key={kind}>
                <input
                  type="radio"
                  name="cadence"
                  checked={s.cadence.kind === kind}
                  onChange={() =>
                    setCadence(kind === 'weekly' ? { kind, postsPerWeek: perWeek } : kind === 'days' ? { kind, days: goalDays, postsPerDay: perDay } : { kind, postsPerDay: perDay })
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        </div>

        <div className="set-row">
          <div className="set-row-text">
            <span>{s.cadence.kind === 'weekly' ? 'Posts per week' : 'Posts per day'}</span>
          </div>
          {s.cadence.kind === 'weekly' ? (
            <Stepper label="posts per week" value={s.cadence.postsPerWeek} min={1} max={50} onChange={(n) => setCadence({ kind: 'weekly', postsPerWeek: n })} />
          ) : (
            <Stepper
              label="posts per day"
              value={perDay}
              min={1}
              max={20}
              onChange={(n) => setCadence(s.cadence.kind === 'days' ? { ...s.cadence, postsPerDay: n } : { kind: 'daily', postsPerDay: n })}
            />
          )}
        </div>

        {s.cadence.kind === 'days' ? (
          <div className="set-row">
            <div className="set-row-text">
              <span>Goal days</span>
              <span className="hint">Other days are rest days.</span>
            </div>
            <Days label="Goal days" value={s.cadence.days} onChange={(d) => setCadence({ kind: 'days', days: d, postsPerDay: perDay })} />
          </div>
        ) : null}

        <div className="set-row">
          <div className="set-row-text">
            <label htmlFor="tz">Time zone</label>
          </div>
          <div className="set-control">
            <select id="tz" className="input" value={s.timeZone} onChange={(e) => set({ timeZone: e.target.value })} style={{ maxWidth: 240 }}>
              {timeZones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="set-row">
          <div className="set-row-text">
            <span>Week starts</span>
          </div>
          <fieldset className="seg" aria-label="Week starts on">
            {(
              [
                [1, 'Mon'],
                [0, 'Sun'],
              ] as const
            ).map(([v, label]) => (
              <label key={v}>
                <input type="radio" name="wso" checked={s.weekStartsOn === v} onChange={() => set({ weekStartsOn: v })} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        </div>
        </div>
      </section>

      <section className="set-section" aria-labelledby="rem-h">
        <div className="set-section-head">
          <h2 id="rem-h" className="set-section-title">
            Reminders
          </h2>
          <p className="set-section-desc">At most one Telegram message a day, and only when your goal isn’t met yet.</p>
        </div>
        <div className="set-card">
        <div className="set-row">
          <div className="set-row-text">
            <label htmlFor="rem-on">Send reminders</label>
          </div>
          <input id="rem-on" type="checkbox" role="switch" className="switch" checked={s.reminders.enabled} onChange={(e) => setRem({ enabled: e.target.checked })} />
        </div>
        {s.reminders.enabled ? (
          <>
            <div className="set-row">
              <div className="set-row-text">
                <label htmlFor="rt">Remind me after</label>
              </div>
              <input id="rt" type="time" className="input" style={{ width: 130 }} value={s.reminders.time} onChange={(e) => setRem({ time: e.target.value })} />
            </div>
            <div className="set-row">
              <div className="set-row-text">
                <span>Remind me on</span>
              </div>
              <Days label="Reminder days" value={s.reminders.days} onChange={(d) => setRem({ days: d })} />
            </div>
            <div className="set-row">
              <div className="set-row-text">
                <label htmlFor="qh">Quiet hours</label>
              </div>
              <div className="set-control">
                {s.reminders.quietHours ? (
                  <>
                    <input type="time" className="input" aria-label="Quiet from" value={s.reminders.quietHours.start} onChange={(e) => setRem({ quietHours: { ...s.reminders.quietHours!, start: e.target.value } })} />
                    <span className="faint">–</span>
                    <input type="time" className="input" aria-label="Quiet until" value={s.reminders.quietHours.end} onChange={(e) => setRem({ quietHours: { ...s.reminders.quietHours!, end: e.target.value } })} />
                  </>
                ) : null}
                <input
                  id="qh"
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={!!s.reminders.quietHours}
                  onChange={(e) => setRem({ quietHours: e.target.checked ? { start: '22:00', end: '08:00' } : null })}
                />
              </div>
            </div>
          </>
        ) : null}
        </div>
      </section>

      <section className="set-section" aria-labelledby="brk-h">
        <div className="set-section-head">
          <h2 id="brk-h" className="set-section-title">
            Breaks
          </h2>
          <p className="set-section-desc">Planned time off. Break days never count against your streak.</p>
        </div>
        <div className="set-card">
        <div className="set-row">
          <div className="set-row-text">
            <span>Upcoming breaks</span>
            {s.pauses.length === 0 ? <span className="hint">No breaks planned.</span> : null}
          </div>
          {s.pauses.length > 0 ? (
            <ul className="breaks">
              {s.pauses.map((p, i) => (
                <li key={`${p.start}-${i}`} className="break-chip">
                  {formatShortDate(p.start)} – {formatShortDate(p.end)}
                  <button type="button" onClick={() => set({ pauses: s.pauses.filter((_, j) => j !== i) })} aria-label={`Remove break from ${p.start} to ${p.end}`}>
                    <IconX size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="set-row">
          <div className="break-form">
            <span className="small muted" style={{ marginRight: 4 }}>
              Add a break
            </span>
            <input type="date" className="input" aria-label="Break starts" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
            <span className="faint">→</span>
            <input type="date" className="input" aria-label="Break ends" min={draft.start} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!draft.start || !draft.end || draft.end < draft.start}
              onClick={() => {
                set({ pauses: [...s.pauses, { start: draft.start, end: draft.end, note: null }].sort((a, b) => a.start.localeCompare(b.start)) });
                setDraft({ start: '', end: '' });
              }}
            >
              <IconPlus size={14} /> Add
            </button>
          </div>
        </div>
        </div>
      </section>

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {dirty ? (
        <div className="savebar" role="region" aria-label="Unsaved changes">
          <span className="small muted">You have unsaved changes</span>
          <div className="savebar-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setS(saved)}>
              Discard
            </button>
            <button className="btn btn-accent btn-sm" type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          <IconCheck size={15} /> Changes saved
        </div>
      ) : null}
    </form>
  );
}
