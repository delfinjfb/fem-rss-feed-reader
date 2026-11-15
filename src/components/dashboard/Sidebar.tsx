'use client';

import { ChevronRight, Inbox } from 'lucide-react';
import { useState } from 'react';
import type { FeedHealth, NavCategory, Selection } from '@/lib/types';
import { FeedIcon } from './FeedIcon';

const HEALTH_LABEL: Record<FeedHealth, string> = {
  active: 'Healthy',
  stale: 'No new posts in 30+ days',
  error: 'Last fetch failed',
  dead: 'Failing repeatedly',
};

const HEALTH_DOT: Record<FeedHealth, string> = {
  active: 'bg-success',
  stale: 'bg-warning',
  error: 'bg-error',
  dead: 'bg-error',
};

interface Props {
  categories: NavCategory[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  unread: (feedIds: string[]) => number;
}

const same = (a: Selection, b: Selection) => a.kind === b.kind && (a.kind === 'all' || (b.kind !== 'all' && a.id === b.id));

function Count({ n, label }: { n: number; label: string }) {
  if (n === 0) return null;
  return (
    <span className="ml-auto text-xs tabular-nums text-text-tertiary">
      {n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

export function Sidebar({ categories, selection, onSelect, unread }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, true])),
  );
  const allIds = categories.flatMap((c) => c.feeds.map((f) => f.id));
  const feeds = categories.flatMap((c) => c.feeds);
  const failing = feeds.filter((f) => f.health === 'error' || f.health === 'dead').length;

  const rowClass = (active: boolean) =>
    `flex w-full min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors ${
      active ? 'bg-accent-subtle font-medium text-accent' : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
    }`;

  return (
    <nav aria-label="Feeds" className="flex flex-col gap-4 p-3">
      <button
        type="button"
        className={rowClass(selection.kind === 'all')}
        aria-current={selection.kind === 'all' ? 'page' : undefined}
        onClick={() => onSelect({ kind: 'all' })}
      >
        <Inbox size={16} aria-hidden="true" />
        All articles
        <Count n={unread(allIds)} label="unread" />
      </button>

      <ul className="flex flex-col gap-1">
        {categories.map((cat) => {
          const isOpen = open[cat.id];
          const sel: Selection = { kind: 'category', id: cat.id };
          return (
            <li key={cat.id}>
              <div className="flex items-center">
                <button
                  type="button"
                  className="grid size-7 shrink-0 place-items-center rounded-md text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
                  aria-expanded={isOpen}
                  aria-controls={`cat-${cat.id}`}
                  onClick={() => setOpen((o) => ({ ...o, [cat.id]: !o[cat.id] }))}
                >
                  <ChevronRight size={14} aria-hidden="true" className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <span className="sr-only">{isOpen ? 'Collapse' : 'Expand'} {cat.name}</span>
                </button>
                <button
                  type="button"
                  className={`${rowClass(same(selection, sel))} font-medium`}
                  aria-current={same(selection, sel) ? 'page' : undefined}
                  onClick={() => onSelect(sel)}
                >
                  {cat.name}
                  <Count n={unread(cat.feeds.map((f) => f.id))} label="unread" />
                </button>
              </div>
              <ul id={`cat-${cat.id}`} hidden={!isOpen} className="mt-0.5 flex flex-col gap-0.5 pl-7">
                {cat.feeds.map((feed) => {
                  const fsel: Selection = { kind: 'feed', id: feed.id };
                  return (
                    <li key={feed.id}>
                      <button
                        type="button"
                        className={rowClass(same(selection, fsel))}
                        aria-current={same(selection, fsel) ? 'page' : undefined}
                        onClick={() => onSelect(fsel)}
                        title={feed.lastError ?? undefined}
                      >
                        <FeedIcon src={feed.iconUrl} title={feed.title} />
                        <span className="truncate">{feed.title}</span>
                        {feed.health !== 'active' && (
                          <span className={`size-1.5 shrink-0 rounded-full ${HEALTH_DOT[feed.health]}`}>
                            <span className="sr-only">({HEALTH_LABEL[feed.health]})</span>
                          </span>
                        )}
                        <Count n={unread([feed.id])} label="unread" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>

      <p className="mt-auto flex items-center gap-2 border-t border-border-subtle px-2 pt-3 text-xs text-text-tertiary">
        <span className={`size-2 rounded-full ${failing ? 'bg-warning' : 'bg-success'}`} aria-hidden="true" />
        {feeds.length - failing} of {feeds.length} feeds healthy
      </p>
    </nav>
  );
}
