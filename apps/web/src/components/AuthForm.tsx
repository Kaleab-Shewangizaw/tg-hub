'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import type { AuthFormState } from '@/app/actions/auth';

interface Props {
  mode: 'sign-in' | 'sign-up';
  action: (prev: AuthFormState, fd: FormData) => Promise<AuthFormState>;
}

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [tz, setTz] = useState('UTC');
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'), []);
  const fe = state.fieldErrors ?? {};
  const up = mode === 'sign-up';

  const field = (name: string, label: string, type: string, autoComplete: string, placeholder?: string) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        className="input"
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        defaultValue={state.values?.[name] ?? ''}
        aria-invalid={fe[name] ? true : undefined}
        aria-describedby={fe[name] ? `${name}-err` : undefined}
      />
      {fe[name] ? (
        <span id={`${name}-err`} className="err">
          {fe[name]}
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="auth-head">
        <h1>{up ? 'Create your account' : 'Welcome back'}</h1>
        <p>{up ? 'Start tracking your posting rhythm in minutes.' : 'Sign in to see your posting rhythm.'}</p>
      </div>
      <form action={formAction} className="auth-form" noValidate>
        {state.error && !Object.keys(fe).length ? (
          <p className="alert" role="alert">
            {state.error}
          </p>
        ) : null}
        {up ? field('name', 'Name', 'text', 'name', 'Ada Lovelace') : null}
        {field('email', 'Email', 'email', 'email', 'you@example.com')}
        {field('password', 'Password', 'password', up ? 'new-password' : 'current-password', up ? 'At least 10 characters' : undefined)}
        {up ? <input type="hidden" name="timeZone" value={tz} /> : null}
        <button className="btn btn-accent btn-lg" type="submit" disabled={pending}>
          {pending ? 'One moment…' : up ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p className="auth-alt">
        {up ? (
          <>
            Already have an account? <Link href="/sign-in">Sign in</Link>
          </>
        ) : (
          <>
            New to Tally? <Link href="/sign-up">Create an account</Link>
          </>
        )}
      </p>
    </>
  );
}
