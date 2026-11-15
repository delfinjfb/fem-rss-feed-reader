'use client';

import { Pencil, RotateCw, Trash2 } from 'lucide-react';
import { useActionState, useId, useState, useTransition } from 'react';
import { FeedIcon } from '@/components/dashboard/FeedIcon';
import { removeSubscriptionAction, retryFeedAction, updateSubscriptionAction, type ActionState } from '@/app/app/feeds/actions';
import { fullDate, relativeTime } from '@/lib/format';
import type { FeedHealth } from '@/lib/types';
import { ActionMessage, ConfirmButton, inputClass, primaryButton, quietButton } from './ui';

export interface ManagedFeed {
  subscriptionId: string;
  categoryId: string | null;
  title: string;
  originalTitle: string;
  url: string;
  siteUrl: string | null;
  description: string | null;
  iconUrl: string | null;
  itemCount: number;
  lastSuccessAt: string | null;
  lastError: string | null;
  health: FeedHealth;
}

const BADGE: Record<FeedHealth, { label: string; className: string }> = {
  active: { label: 'Healthy', className: 'text-success' },
  stale: { label: 'Quiet 30+ days', className: 'text-warning' },
  error: { label: 'Fetch failed, retrying', className: 'text-error' },
  dead: { label: 'Failing repeatedly', className: 'text-error' },
};

export function FeedRow({ feed, categories }: { feed: ManagedFeed; categories: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await updateSubscriptionAction(prev, fd);
    if (!r.error) setEditing(false);
    return r;
  }, {});
  const [retryState, setRetryState] = useState<ActionState>({});
  const [retrying, startRetry] = useTransition();
  const formId = useId();
  const badge = BADGE[feed.health];

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <FeedIcon src={feed.iconUrl} title={feed.title} size={20} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{feed.title}</p>
          <p className="truncate text-xs text-text-tertiary" title={feed.url}>{feed.url}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
            <span className={`font-medium ${badge.className}`}>{badge.label}</span>
            <span>{feed.itemCount} articles</span>
            <span>
              Last updated{' '}
              {feed.lastSuccessAt ? (
                <time dateTime={feed.lastSuccessAt} title={fullDate(feed.lastSuccessAt)} suppressHydrationWarning>
                  {relativeTime(feed.lastSuccessAt)}
                </time>
              ) : (
                'never'
              )}
            </span>
          </p>
          {feed.lastError && <p className="mt-1 text-xs text-error">{feed.lastError}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 pl-8">
        <button type="button" className={quietButton} aria-expanded={editing} aria-controls={formId} onClick={() => setEditing((e) => !e)}>
          <Pencil size={14} aria-hidden="true" /> Edit<span className="sr-only"> {feed.title}</span>
        </button>
        {(feed.health === 'error' || feed.health === 'dead') && (
          <button
            type="button"
            className={quietButton}
            disabled={retrying}
            onClick={() => startRetry(async () => setRetryState(await retryFeedAction(feed.subscriptionId)))}
          >
            <RotateCw size={14} aria-hidden="true" className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Retrying…' : 'Retry now'}
            <span className="sr-only"> {feed.title}</span>
          </button>
        )}
        <ConfirmButton
          label="Remove"
          icon={<Trash2 size={14} aria-hidden="true" />}
          title={`Remove ${feed.title}?`}
          body="Its articles leave your front page, along with your read marks and bookmarks for it. You can add it again later."
          confirmLabel="Remove feed"
          onConfirm={() => removeSubscriptionAction(feed.subscriptionId)}
        />
        <ActionMessage state={retryState} />
      </div>

      {editing && (
        <form id={formId} action={action} className="grid gap-3 pl-8 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <input type="hidden" name="subscriptionId" value={feed.subscriptionId} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-title`} className="text-sm font-medium">Display name</label>
            <input id={`${formId}-title`} name="title" defaultValue={feed.title} placeholder={feed.originalTitle} maxLength={80} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-cat`} className="text-sm font-medium">Category</label>
            <select id={`${formId}-cat`} name="categoryId" defaultValue={feed.categoryId ?? ''} className={inputClass}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className={primaryButton}>Save</button>
          <div className="sm:col-span-3">
            <ActionMessage state={state} />
          </div>
        </form>
      )}
    </li>
  );
}
