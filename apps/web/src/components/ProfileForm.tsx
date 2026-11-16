'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveProfileAction, type ProfileFormState } from '@/app/actions/social';

interface Props {
  initial: { name: string; handle: string; bio: string | null; profilePublic: boolean };
}

export function ProfileForm({ initial }: Props) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfileAction, { ok: false, error: null });
  const [name, setName] = useState(initial.name);
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio ?? '');
  const [isPublic, setIsPublic] = useState(initial.profilePublic);
  const fe = state.fieldErrors ?? {};

  return (
    <section className="set-section" id="profile" aria-labelledby="prof-h">
      <div className="set-section-head set-section-head-row">
        <div>
          <h2 id="prof-h" className="set-section-title">
            Public profile
          </h2>
          <p className="set-section-desc">How other creators find and follow you.</p>
        </div>
        <Link href={`/u/${initial.handle}`} className="btn btn-ghost btn-sm">
          View profile
        </Link>
      </div>
      <form action={action} className="set-card">
        <div className="set-row">
          <div className="set-row-text">
            <label htmlFor="p-name">Display name</label>
          </div>
          <div className="set-field">
            <input id="p-name" name="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required aria-invalid={fe.name ? true : undefined} />
            {fe.name ? <span className="err">{fe.name}</span> : null}
          </div>
        </div>
        <div className="set-row">
          <div className="set-row-text">
            <label htmlFor="p-handle">Handle</label>
            <span className="hint">Your profile link.</span>
          </div>
          <div className="set-field">
            <div className="input-affix">
              <span>/u/</span>
              <input
                id="p-handle"
                name="handle"
                className="input"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                maxLength={30}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                required
                aria-invalid={fe.handle ? true : undefined}
              />
            </div>
            {fe.handle ? <span className="err">{fe.handle}</span> : null}
          </div>
        </div>
        <div className="set-row">
          <div className="set-row-text">
            <label htmlFor="p-bio">Bio</label>
            <span className="hint">A line about you or your channel.</span>
          </div>
          <div className="set-field">
            <textarea
              id="p-bio"
              name="bio"
              className="input textarea"
              rows={2}
              maxLength={160}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Field recordings and notes from the city."
              aria-invalid={fe.bio ? true : undefined}
            />
            <span className="faint small" style={{ justifySelf: 'end' }}>
              {bio.length}/160
            </span>
            {fe.bio ? <span className="err">{fe.bio}</span> : null}
          </div>
        </div>
        <div className="set-row">
          <div className="set-row-text">
            <label htmlFor="p-public">Public profile</label>
            <span className="hint">When off, only you can see your profile and nobody new can follow you.</span>
          </div>
          <input id="p-public" name="profilePublic" type="checkbox" role="switch" className="switch" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        </div>
        <div className="set-row set-row-end">
          {state.ok && !pending ? (
            <span className="small saved-note" role="status">
              Profile saved
            </span>
          ) : null}
          {state.error ? (
            <span className="err" role="alert">
              {state.error}
            </span>
          ) : null}
          <button className="btn btn-sm" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </section>
  );
}
