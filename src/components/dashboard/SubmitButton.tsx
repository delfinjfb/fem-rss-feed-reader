'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-70"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
