'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { addFeedAction } from '@/app/app/feeds/actions';
import { ActionMessage, inputClass, primaryButton } from './ui';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={primaryButton}>
      {pending ? 'Checking the feed…' : 'Add feed'}
    </button>
  );
}

export function AddFeedForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action] = useActionState(addFeedAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-url" className="text-sm font-medium">Feed or website URL</label>
          <input
            id="add-url"
            name="url"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            placeholder="example.com/feed"
            aria-invalid={state.error ? true : undefined}
            aria-describedby="add-result"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-category" className="text-sm font-medium">Category</label>
          <select id="add-category" name="categoryId" className={inputClass} defaultValue="">
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Submit />
        <div id="add-result">
          <ActionMessage state={state} />
        </div>
      </div>
    </form>
  );
}
