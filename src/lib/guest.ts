import 'server-only';
import sample from '../../data/sample-feeds.json';
import { prisma } from '@/lib/db';
import { faviconFor } from '@/lib/feeds/items';

export interface SampleFeed {
  title: string;
  feedUrl: string;
  siteUrl: string;
  description?: string;
}

export const GUEST_CATEGORIES: { name: string; feeds: SampleFeed[] }[] = sample.categories;
const GUEST_FEEDS = GUEST_CATEGORIES.flatMap((c) => c.feeds);

/**
 * Make sure the 19 curated feeds exist as shared Feed rows and return them keyed by sample URL.
 * Feeds whose URL moved after a permanent redirect are still found through previousUrl.
 */
export async function ensureGuestFeeds() {
  const urls = GUEST_FEEDS.map((f) => f.feedUrl);
  const find = () =>
    prisma.feed.findMany({ where: { OR: [{ url: { in: urls } }, { previousUrl: { in: urls } }] } });
  let existing = await find();
  const known = new Set(existing.flatMap((f) => [f.url, f.previousUrl]));
  const missing = GUEST_FEEDS.filter((f) => !known.has(f.feedUrl));
  if (missing.length) {
    await prisma.feed.createMany({
      data: missing.map((f) => ({
        url: f.feedUrl,
        title: f.title,
        siteUrl: f.siteUrl,
        description: f.description ?? null,
        iconUrl: faviconFor(f.siteUrl),
      })),
      skipDuplicates: true,
    });
    existing = await find();
  }
  const bySampleUrl = new Map<string, (typeof existing)[number]>();
  for (const feed of existing) bySampleUrl.set(feed.previousUrl && urls.includes(feed.previousUrl) ? feed.previousUrl : feed.url, feed);
  return bySampleUrl;
}
