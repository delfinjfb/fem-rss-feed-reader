'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Circle, CircleCheck, ExternalLink } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { fullDate, relativeTime } from '@/lib/format';
import type { ItemDTO, ItemsPage, NavFeed, Selection } from '@/lib/types';
import { FeedIcon } from './FeedIcon';

interface Props {
  selection: Selection;
  initialPage: ItemsPage | null;
  feedsById: Map<string, NavFeed>;
  isRead: (id: string) => boolean;
  onToggleRead: (item: ItemDTO, read: boolean) => void;
}

function query(selection: Selection, cursor: string | null) {
  const p = new URLSearchParams();
  if (selection.kind === 'feed') p.set('feed', selection.id);
  if (selection.kind === 'category') p.set('category', selection.id);
  if (cursor) p.set('cursor', cursor);
  return `/api/guest/items?${p}`;
}

export function ItemList({ selection, initialPage, feedsById, isRead, onToggleRead }: Props) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, isError, refetch } = useInfiniteQuery({
    queryKey: ['guest-items', selection],
    queryFn: async ({ pageParam }): Promise<ItemsPage> => {
      const res = await fetch(query(selection, pageParam));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: initialPage ? { pages: [initialPage], pageParams: [null] } : undefined,
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && !isFetchingNextPage && fetchNextPage(), {
      rootMargin: '600px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) return <ListSkeleton />;
  if (isError) {
    return (
      <div role="alert" className="p-8 text-center text-sm text-text-secondary">
        Articles could not be loaded.{' '}
        <button type="button" onClick={() => refetch()} className="font-medium text-accent underline">
          Try again
        </button>
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="p-8 text-center text-sm text-text-secondary">No articles here yet. Feeds refresh every 15 minutes.</p>;
  }

  return (
    <>
      <ol className="divide-y divide-border-subtle">
        {items.map((item) => {
          const feed = feedsById.get(item.feedId);
          const read = isRead(item.id);
          return (
            <li key={item.id} className="group relative flex gap-3 px-4 py-4 hover:bg-bg-secondary sm:px-6">
              <span
                aria-hidden="true"
                className={`mt-2 size-2 shrink-0 rounded-full ${read ? 'bg-transparent' : 'bg-unread'}`}
              />
              <article className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
                  <FeedIcon src={feed?.iconUrl ?? null} title={feed?.title ?? '?'} size={14} />
                  <span className="truncate font-medium text-text-secondary">{feed?.title}</span>
                  {item.publishedAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <time dateTime={item.publishedAt} title={fullDate(item.publishedAt)} suppressHydrationWarning>
                        {relativeTime(item.publishedAt)}
                      </time>
                    </>
                  )}
                </p>
                <h2 className={`mt-1 text-base leading-snug ${read ? 'font-normal text-text-secondary' : 'font-semibold text-text-primary'}`}>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onToggleRead(item, true)}
                      className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent"
                    >
                      {item.title}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    item.title
                  )}
                </h2>
                {item.summary && <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{item.summary}</p>}
              </article>
              <div className="relative z-10 flex shrink-0 items-start gap-1 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onToggleRead(item, !read)}
                  className="grid size-9 place-items-center rounded-md text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
                >
                  {read ? <CircleCheck size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                  <span className="sr-only">Mark “{item.title}” as {read ? 'unread' : 'read'}</span>
                </button>
                <ExternalLink size={16} aria-hidden="true" className="mt-2.5 hidden text-text-tertiary sm:block" />
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={sentinel} className="flex justify-center p-6">
        {hasNextPage ? (
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary disabled:opacity-60"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        ) : (
          <p className="text-xs text-text-tertiary">You’re all caught up.</p>
        )}
      </div>
    </>
  );
}

export function ListSkeleton() {
  return (
    <ul aria-hidden="true" className="divide-y divide-border-subtle">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="flex gap-3 px-4 py-4 sm:px-6">
          <span className="mt-2 size-2 rounded-full bg-bg-tertiary" />
          <div className="flex-1 animate-pulse space-y-2">
            <div className="h-3 w-40 rounded bg-bg-tertiary" />
            <div className="h-4 w-3/4 rounded bg-bg-tertiary" />
            <div className="h-3 w-full rounded bg-bg-tertiary" />
          </div>
        </li>
      ))}
    </ul>
  );
}
