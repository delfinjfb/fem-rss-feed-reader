'use client';

import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from './actions';

export interface FieldSpec {
  name: string;
  label: string;
  type?: 'email' | 'password' | 'text' | 'hidden';
  autoComplete?: string;
  hint?: string;
  required?: boolean;
  defaultValue?: string;
}

interface Props {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  fields: FieldSpec[];
  submitLabel: string;
  pendingLabel: string;
}

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-70"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AuthForm({ action, fields, submitLabel, pendingLabel }: Props) {
  const [state, formAction] = useActionState(action, {});
  const id = useId();

  if (state.message) {
    return (
      <p role="status" className="rounded-md bg-accent-subtle p-4 text-sm text-text-primary">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.error && (
        <p role="alert" className="rounded-md border border-error/40 bg-error/10 p-3 text-sm text-text-primary">
          {state.error}
        </p>
      )}
      {fields.map((f) => {
        if (f.type === 'hidden') return <input key={f.name} type="hidden" name={f.name} value={f.defaultValue ?? ''} />;
        const inputId = `${id}-${f.name}`;
        const errors = state.fieldErrors?.[f.name];
        const describedBy = [errors?.length && `${inputId}-error`, f.hint && `${inputId}-hint`].filter(Boolean).join(' ');
        return (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
              {f.label}
            </label>
            <input
              id={inputId}
              name={f.name}
              type={f.type ?? 'text'}
              autoComplete={f.autoComplete}
              required={f.required}
              defaultValue={state.values?.[f.name] ?? f.defaultValue}
              aria-invalid={errors?.length ? true : undefined}
              aria-describedby={describedBy || undefined}
              className="min-h-11 rounded-md border border-border bg-surface px-3 text-base text-text-primary aria-[invalid=true]:border-error"
            />
            {f.hint && (
              <p id={`${inputId}-hint`} className="text-xs text-text-tertiary">
                {f.hint}
              </p>
            )}
            {errors?.length ? (
              <p id={`${inputId}-error`} className="text-sm text-error">
                {errors[0]}
              </p>
            ) : null}
          </div>
        );
      })}
      <Submit label={submitLabel} pendingLabel={pendingLabel} />
    </form>
  );
}
