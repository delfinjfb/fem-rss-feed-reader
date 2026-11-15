import 'server-only';
import { prisma } from '@/lib/db';
import type { Feed } from '@/generated/prisma/client';
import { fetchFeed, nextFetchDelayMs } from './fetch';
import { faviconFor, toItemRows } from './items';

/** Never hit the same source more often than this, whatever the user's refresh setting. */
export const MIN_REFRESH_MS = 15 * 60_000;
const CONCURRENCY = 6;

export interface RefreshOutcome {
  feedId: string;
  ok: boolean;
  newItems: number;
}

/** Fetch one feed, store new items, and record health + backoff. Never throws. */
export async function refreshFeed(feed: Feed): Promise<RefreshOutcome> {
  const now = new Date();
  const result = await fetchFeed(feed.url, { etag: feed.etag, lastModified: feed.lastModified });

  if (result.kind === 'error') {
    const errorCount = feed.errorCount + 1;
    await prisma.feed.update({
      where: { id: feed.id },
      data: {
        lastFetchedAt: now,
        lastError: result.message,
        errorCount,
        nextFetchAt: new Date(now.getTime() + nextFetchDelayMs(errorCount)),
      },
    });
    return { feedId: feed.id, ok: false, newItems: 0 };
  }

  const healthy = {
    lastFetchedAt: now,
    lastSuccessAt: now,
    lastError: null,
    errorCount: 0,
    nextFetchAt: new Date(now.getTime() + MIN_REFRESH_MS),
  };

  if (result.kind === 'not-modified') {
    await prisma.feed.update({ where: { id: feed.id }, data: healthy });
    return { feedId: feed.id, ok: true, newItems: 0 };
  }

  const { feed: parsed } = result;
  // Same guid seen again = same item; the first stored version wins (no churn on every refetch).
  const { count } = await prisma.item.createMany({
    data: toItemRows(feed.id, parsed.items, now),
    skipDuplicates: true,
  });

  const moved = result.movedPermanently && result.finalUrl !== feed.url;
  const urlTaken = moved && (await prisma.feed.findUnique({ where: { url: result.finalUrl }, select: { id: true } }));
  const siteUrl = parsed.siteUrl ?? feed.siteUrl;

  await prisma.feed.update({
    where: { id: feed.id },
    data: {
      ...healthy,
      etag: result.etag,
      lastModified: result.lastModified,
      siteUrl,
      description: parsed.description ?? feed.description,
      iconUrl: feed.iconUrl ?? faviconFor(siteUrl),
      ...(moved && !urlTaken ? { url: result.finalUrl, previousUrl: feed.url } : {}),
    },
  });
  return { feedId: feed.id, ok: true, newItems: count };
}

/** Run tasks with at most `limit` in flight. */
async function pool<T, R>(inputs: T[], limit: number, task: (input: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < inputs.length) {
      const i = next++;
      results[i] = await task(inputs[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker));
  return results;
}

/**
 * Refresh the given feeds that are due (never fetched, or past their nextFetchAt).
 * `force` ignores nextFetchAt but still respects MIN_REFRESH_MS, so a refresh button can't hammer a source.
 */
export async function refreshDueFeeds(feedIds: string[], { force = false } = {}): Promise<RefreshOutcome[]> {
  const now = new Date();
  const due = await prisma.feed.findMany({
    where: {
      id: { in: feedIds },
      OR: force
        ? [{ lastFetchedAt: null }, { lastFetchedAt: { lt: new Date(now.getTime() - MIN_REFRESH_MS) } }]
        : [{ nextFetchAt: null }, { nextFetchAt: { lte: now } }],
    },
  });
  return pool(due, CONCURRENCY, refreshFeed);
}
