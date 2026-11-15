'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useActionState, useEffect, useRef, useTransition } from 'react';
import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from '@/app/app/feeds/actions';
import { ActionMessage, ConfirmButton, inputClass, primaryButton, quietButton } from './ui';

interface Cat {
  id: string;
  name: string;
  feedCount: number;
}

function CategoryRow({ cat, first, last }: { cat: Cat; first: boolean; last: boolean }) {
  const [state, rename] = useActionState(renameCategoryAction, {});
  const [moving, startMove] = useTransition();
  const move = (dir: 'up' | 'down') => startMove(async () => void (await moveCategoryAction(cat.id, dir)));

  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <form action={rename} className="flex min-w-0 flex-1 items-center gap-2">
        <input type="hidden" name="categoryId" value={cat.id} />
        <label htmlFor={`cat-${cat.id}`} className="sr-only">Category name</label>
        <input id={`cat-${cat.id}`} name="name" defaultValue={cat.name} maxLength={40} className={`${inputClass} min-w-0 flex-1`} />
        <button type="submit" className={quietButton}>Rename<span className="sr-only"> {cat.name}</span></button>
      </form>
      <span className="text-xs text-text-tertiary">{cat.feedCount} feeds</span>
      <button type="button" className={quietButton} disabled={first || moving} onClick={() => move('up')}>
        <ArrowUp size={14} aria-hidden="true" /><span className="sr-only">Move {cat.name} up</span>
      </button>
      <button type="button" className={quietButton} disabled={last || moving} onClick={() => move('down')}>
        <ArrowDown size={14} aria-hidden="true" /><span className="sr-only">Move {cat.name} down</span>
      </button>
      <ConfirmButton
        label=""
        icon={<><Trash2 size={14} aria-hidden="true" /><span className="sr-only">Delete {cat.name}</span></>}
        title={`Delete ${cat.name}?`}
        body={`Its ${cat.feedCount} feed${cat.feedCount === 1 ? '' : 's'} move to Uncategorized. No feed is removed.`}
        confirmLabel="Delete category"
        onConfirm={() => deleteCategoryAction(cat.id)}
      />
      {(state.error || state.success) && (
        <div className="basis-full">
          <ActionMessage state={state} />
        </div>
      )}
    </li>
  );
}

export function CategoryManager({ categories }: { categories: Cat[] }) {
  const [state, create] = useActionState(createCategoryAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);

  return (
    <section aria-labelledby="cat-heading" className="flex flex-col gap-4">
      <h2 id="cat-heading" className="text-lg font-semibold">Categories</h2>
      {categories.length > 0 && (
        <ol className="divide-y divide-border-subtle rounded-lg border border-border">
          {categories.map((c, i) => (
            <CategoryRow key={c.id} cat={c} first={i === 0} last={i === categories.length - 1} />
          ))}
        </ol>
      )}
      <form ref={form} action={create} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="new-category" className="text-sm font-medium">New category</label>
          <input id="new-category" name="name" required maxLength={40} placeholder="e.g. Newsletters" className={inputClass} />
        </div>
        <button type="submit" className={primaryButton}>Create</button>
        <div className="basis-full">
          <ActionMessage state={state} />
        </div>
      </form>
    </section>
  );
}
