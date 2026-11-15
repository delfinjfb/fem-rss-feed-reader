'use client';

import { useId, useRef, useTransition } from 'react';
import type { ActionState } from '@/app/app/feeds/actions';

export const inputClass =
  'min-h-11 rounded-md border border-border bg-surface px-3 text-base text-text-primary aria-[invalid=true]:border-error';
export const primaryButton =
  'min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60';
export const quietButton =
  'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50';

/** Inline result line for a form action (polite live region). */
export function ActionMessage({ state }: { state: ActionState }) {
  return (
    <p aria-live="polite" className={`min-h-5 text-sm ${state.error ? 'text-error' : 'text-success'}`}>
      {state.error ?? state.success ?? ''}
    </p>
  );
}

/**
 * A destructive button that asks first in a native <dialog> (focus trap and Escape for free).
 * Focus returns to the trigger when the dialog closes.
 */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  onConfirm,
  icon,
}: {
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  icon?: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const titleId = useId();
  return (
    <>
      <button type="button" className={quietButton} onClick={() => dialog.current?.showModal()}>
        {icon}
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-6 text-text-primary shadow-lg backdrop:bg-black/40"
      >
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-text-secondary">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={quietButton} onClick={() => dialog.current?.close()} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            className="min-h-9 rounded-md bg-error px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            onClick={() =>
              start(async () => {
                await onConfirm();
                dialog.current?.close();
              })
            }
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
