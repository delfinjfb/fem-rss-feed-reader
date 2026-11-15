import 'server-only';
import { prisma } from '@/lib/db';
import type { Feed, Prisma } from '@/generated/prisma/client';
import { feedHealth } from '@/lib/feeds/fetch';
import { decodeCursor, encodeCursor } from '@/lib/feeds/items';
import type { ItemsPage, NavFeed } from '@/lib/types';

export const PAGE_SIZE = 30;

/** Item count and newest item date per feed, in one grouped query. */
export async function feedStats(feedIds: string[]) {
  const rows = await prisma.item.groupBy({
    by: ['feedId'],
    where: { feedId: { in: feedIds } },
    _count: { _all: true },
    _max: { sortDate: true },
  });
  return new Map(rows.map((r) => [r.feedId, { count: r._count._all, latest: r._max.sortDate }]));
}

export function toNavFeed(
  feed: Feed,
  title: string,
  stats?: { count: number; latest: Date | null },
  readCount = 0,
): NavFeed {
  return {
    id: feed.id,
    title,
    siteUrl: feed.siteUrl,
    iconUrl: feed.iconUrl,
    health: feedHealth({ lastError: feed.lastError, errorCount: feed.errorCount, latestItemAt: stats?.latest ?? null }),
    lastSuccessAt: feed.lastSuccessAt?.toISOString() ?? null,
    lastError: feed.lastError,
    itemCount: stats?.count ?? 0,
    unreadCount: Math.max(0, (stats?.count ?? 0) - readCount),
  };
}

/** Keyset-paginated items for a set of feeds, newest first, optional title/summary search. */
export async function itemsPage(
  feedIds: string[],
  opts: { cursor?: string | null; q?: string | null; userId?: string } = {},
): Promise<ItemsPage> {
  const cursor = decodeCursor(opts.cursor);
  const q = opts.q?.trim();
  const where: Prisma.ItemWhereInput = {
    feedId: { in: feedIds },
    ...(cursor && {
      OR: [{ sortDate: { lt: cursor.sortDate } }, { sortDate: cursor.sortDate, id: { lt: cursor.id } }],
    }),
    ...(q && {
      AND: [{ OR: [{ title: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }] }],
    }),
  };
  const rows = await prisma.item.findMany({
    where,
    orderBy: [{ sortDate: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    select: {
      id: true, feedId: true, title: true, url: true, summary: true, imageUrl: true,
      author: true, publishedAt: true, sortDate: true, hasContent: true,
      reads: opts.userId ? { where: { userId: opts.userId }, select: { read: true } } : false,
    },
  });
  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      id: r.id,
      feedId: r.feedId,
      title: r.title,
      url: r.url,
      summary: r.summary,
      imageUrl: r.imageUrl,
      author: r.author,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      hasContent: r.hasContent,
      read: r.reads?.[0]?.read ?? false,
    })),
    nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last) : null,
  };
}

/** Items the user marked read, per feed (one grouped query over ReadState joined to Item). */
export async function readCountsByFeed(userId: string, feedIds: string[]): Promise<Map<string, number>> {
  if (feedIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ feedId: string; n: bigint }[]>`
    SELECT i."feedId", COUNT(*) AS n
    FROM "ReadState" r JOIN "Item" i ON i.id = r."itemId"
    WHERE r."userId" = ${userId} AND r.read AND i."feedId" = ANY(${feedIds})
    GROUP BY i."feedId"`;
  return new Map(rows.map((r) => [r.feedId, Number(r.n)]));
}
