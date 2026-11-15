import { decodeHTML } from 'entities';

export interface DiscoveredFeed {
  url: string;
  title: string | null;
}

const FEED_TYPES = new Set(['application/rss+xml', 'application/atom+xml', 'application/rdf+xml']);
const LINK_TAG = /<link\b[^>]*>/gi;
const ATTR = /([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(ATTR)) out[m[1].toLowerCase()] = decodeHTML(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

export const looksLikeHtml = (text: string) => /^\s*(<!doctype html|<html[\s>])/i.test(text);

/** Feed URLs a web page advertises with <link rel="alternate" type="application/rss+xml|atom+xml">. */
export function discoverFeedLinks(html: string, pageUrl: string): DiscoveredFeed[] {
  const head = html.slice(0, 200_000); // links live in <head>; bound the scan
  const found: DiscoveredFeed[] = [];
  const seen = new Set<string>();
  for (const [tag] of head.matchAll(LINK_TAG)) {
    const a = attributes(tag);
    if (!a.rel?.toLowerCase().split(/\s+/).includes('alternate')) continue;
    if (!FEED_TYPES.has(a.type?.toLowerCase() ?? '')) continue;
    let url: URL;
    try {
      url = new URL(a.href ?? '', pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    found.push({ url: url.href, title: a.title || null });
  }
  return found;
}
