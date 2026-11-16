'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteUserAction, updateUserAction, type AdminEditState, type DeleteUserState } from '@/app/actions/admin';

function Submit({ children, className = 'btn btn-sm', pendingLabel }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingLabel ?? 'Saving…') : children}
    </button>
  );
}

export function EditUserForm({ user }: { user: { id: string; name: string; email: string; handle: string } }) {
  const [state, action] = useActionState<AdminEditState, FormData>(updateUserAction, { ok: false, error: null });
  return (
    <form action={action} className="adm-form">
      <input type="hidden" name="userId" value={user.id} />
      <div className="field">
        <label htmlFor="adm-name">Name</label>
        <input id="adm-name" name="name" className="input" defaultValue={user.name} required maxLength={60} />
      </div>
      <div className="field">
        <label htmlFor="adm-email">Email</label>
        <input id="adm-email" name="email" type="email" className="input" defaultValue={user.email} required />
      </div>
      <div className="field">
        <label htmlFor="adm-handle">Handle</label>
        <div className="input-affix">
          <span>@</span>
          <input id="adm-handle" name="handle" className="input" defaultValue={user.handle} required maxLength={30} />
        </div>
      </div>
      <div className="adm-form-foot">
        {state.error ? (
          <p className="err small" role="alert">
            {state.error}
          </p>
        ) : state.ok ? (
          <p className="saved-note" role="status">
            Saved
          </p>
        ) : (
          <span />
        )}
        <Submit>Save changes</Submit>
      </div>
    </form>
  );
}

export function DeleteUserForm({ userId, handle }: { userId: string; handle: string }) {
  const [state, action] = useActionState<DeleteUserState, FormData>(deleteUserAction, { error: null });
  return (
    <form action={action} className="adm-danger-form">
      <input type="hidden" name="userId" value={userId} />
      <label htmlFor="adm-confirm" className="small muted">
        Type <strong className="mono">{handle}</strong> to permanently delete this account, its channels and all posts.
      </label>
      <div className="row-form">
        <input id="adm-confirm" name="confirm" className="input" autoComplete="off" placeholder={handle} />
        <Submit className="btn btn-sm btn-danger" pendingLabel="Deleting…">
          Delete account
        </Submit>
      </div>
      {state.error ? (
        <p className="err small" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** A submit button that asks first. Used inside plain server-action forms. */
export function ConfirmSubmit({ message, children, className = 'btn btn-sm btn-ghost' }: { message: string; children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
