import 'server-only';
import { prisma } from '@/lib/db';
import { discoverFeedLinks } from './discover';
import { fetchFeed, type FetchResult } from './fetch';
import { applyFetchResult } from './ingest';
import { faviconFor } from './items';

export const MAX_SUBSCRIPTIONS = 200;

export type SubscribeResult =
  | { ok: true; title: string; description: string | null; iconUrl: string | null; siteUrl: string | null; discovered: boolean }
  | { ok: false; error: string };

/** "css-tricks.com/feed" -> "https://css-tricks.com/feed"; null when it can't be a web URL. */
export function normalizeInputUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Fetch a URL as a feed; if it is a web page, follow the first feed it advertises (one hop). */
async function fetchWithDiscovery(url: string): Promise<{ result: FetchResult; url: string; discovered: boolean }> {
  const first = await fetchFeed(url);
  if (first.kind !== 'error' || !first.page) return { result: first, url, discovered: false };
  const [candidate] = discoverFeedLinks(first.page.html, first.page.url);
  if (!candidate) {
    return {
      result: { kind: 'error', message: 'No RSS or Atom feed found at this address. Try the site’s feed URL.', permanent: true },
      url,
      discovered: false,
    };
  }
  return { result: await fetchFeed(candidate.url), url: candidate.url, discovered: true };
}

/**
 * Validate a feed URL (fetch + parse, with autodiscovery) and subscribe the user to it.
 * Feed rows are shared: a URL another user already follows is reused without refetching.
 */
export async function subscribeToUrl(userId: string, rawUrl: string, categoryId: string | null): Promise<SubscribeResult> {
  const url = normalizeInputUrl(rawUrl);
  if (!url) return { ok: false, error: 'Enter a web address, like https://example.com/feed.' };

  if ((await prisma.subscription.count({ where: { userId } })) >= MAX_SUBSCRIPTIONS) {
    return { ok: false, error: `You can follow up to ${MAX_SUBSCRIPTIONS} feeds. Remove one to add another.` };
  }
  if (categoryId && !(await prisma.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } }))) {
    return { ok: false, error: 'That category no longer exists.' };
  }

  let feed = await prisma.feed.findFirst({ where: { OR: [{ url }, { previousUrl: url }], lastSuccessAt: { not: null } } });
  let discovered = false;

  if (!feed) {
    const fetched = await fetchWithDiscovery(url);
    if (fetched.result.kind !== 'ok') {
      return { ok: false, error: fetched.result.kind === 'error' ? fetched.result.message : 'The feed could not be read.' };
    }
    discovered = fetched.discovered;
    const finalUrl = fetched.result.finalUrl;
    const parsed = fetched.result.feed;
    feed =
      (await prisma.feed.findFirst({ where: { OR: [{ url: finalUrl }, { previousUrl: finalUrl }] } })) ??
      (await prisma.feed.create({
        data: {
          url: finalUrl,
          title: parsed.title,
          siteUrl: parsed.siteUrl,
          description: parsed.description,
          iconUrl: faviconFor(parsed.siteUrl ?? finalUrl),
        },
      }));
    await applyFetchResult(feed, fetched.result);
  }

  const existing = await prisma.subscription.findUnique({ where: { userId_feedId: { userId, feedId: feed.id } } });
  if (existing) return { ok: false, error: `You already follow ${existing.customTitle ?? feed.title}.` };

  await prisma.subscription.create({ data: { userId, feedId: feed.id, categoryId } });
  return { ok: true, title: feed.title, description: feed.description, iconUrl: feed.iconUrl, siteUrl: feed.siteUrl, discovered };
}
