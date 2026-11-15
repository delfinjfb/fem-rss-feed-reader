import 'server-only';
import { ensureGuestFeeds, GUEST_CATEGORIES } from '@/lib/guest';
import { feedStats, toNavFeed } from '@/lib/queries';
import type { NavCategory, Selection } from '@/lib/types';

export const slugify = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The guest's sidebar: the curated categories, each feed with health and item count. */
export async function guestNavigation(): Promise<{ categories: NavCategory[]; feedIds: string[] }> {
  const feeds = await ensureGuestFeeds();
  const feedIds = [...feeds.values()].map((f) => f.id);
  const stats = await feedStats(feedIds);
  const categories = GUEST_CATEGORIES.map((cat) => ({
    id: slugify(cat.name),
    name: cat.name,
    feeds: cat.feeds.flatMap((sample) => {
      const feed = feeds.get(sample.feedUrl);
      return feed ? [toNavFeed(feed, sample.title, stats.get(feed.id))] : [];
    }),
  }));
  return { categories, feedIds };
}

/** Resolve a sidebar selection to the feed ids it covers, restricted to the guest's feeds. */
export function feedIdsFor(selection: Selection, categories: NavCategory[]): string[] {
  const all = categories.flatMap((c) => c.feeds.map((f) => f.id));
  if (selection.kind === 'category') return categories.find((c) => c.id === selection.id)?.feeds.map((f) => f.id) ?? [];
  if (selection.kind === 'feed') return all.includes(selection.id) ? [selection.id] : [];
  return all;
}
