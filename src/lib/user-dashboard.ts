import 'server-only';
import { prisma } from '@/lib/db';
import { feedStats, readCountsByFeed, toNavFeed } from '@/lib/queries';
import type { NavCategory, Selection } from '@/lib/types';

export const UNCATEGORIZED_ID = 'uncategorized';

/** The signed-in user's sidebar: their categories in order, then "Uncategorized" if any feed has none. */
export async function userNavigation(userId: string): Promise<{ categories: NavCategory[]; feedIds: string[] }> {
  const [categories, subscriptions] = await Promise.all([
    prisma.category.findMany({ where: { userId }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    prisma.subscription.findMany({ where: { userId }, include: { feed: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  const feedIds = subscriptions.map((s) => s.feedId);
  const [stats, reads] = await Promise.all([feedStats(feedIds), readCountsByFeed(userId, feedIds)]);

  const navFeed = (s: (typeof subscriptions)[number]) =>
    toNavFeed(s.feed, s.customTitle ?? s.feed.title, stats.get(s.feedId), reads.get(s.feedId) ?? 0);

  const nav: NavCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    feeds: subscriptions.filter((s) => s.categoryId === c.id).map(navFeed),
  }));
  const loose = subscriptions.filter((s) => s.categoryId === null);
  if (loose.length) nav.push({ id: UNCATEGORIZED_ID, name: 'Uncategorized', feeds: loose.map(navFeed) });
  return { categories: nav, feedIds };
}

/** Feed ids a selection covers, limited to feeds this user subscribes to. */
export async function userFeedIdsFor(userId: string, selection: Selection): Promise<string[]> {
  const where =
    selection.kind === 'feed'
      ? { userId, feedId: selection.id }
      : selection.kind === 'category'
        ? { userId, categoryId: selection.id === UNCATEGORIZED_ID ? null : selection.id }
        : { userId };
  const subs = await prisma.subscription.findMany({ where, select: { feedId: true } });
  return subs.map((s) => s.feedId);
}
