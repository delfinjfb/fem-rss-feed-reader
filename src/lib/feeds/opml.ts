import { XMLParser } from 'fast-xml-parser';

export interface OpmlFeed {
  url: string;
  title: string | null;
  siteUrl: string | null;
  category: string | null;
}

export interface OpmlParseResult {
  feeds: OpmlFeed[];
  duplicates: OpmlFeed[];
  invalid: number;
}

export interface OpmlCategory {
  name: string | null; // null = Uncategorized (exported at the root)
  feeds: { title: string; url: string; siteUrl: string | null }[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  htmlEntities: true,
  isArray: (name) => name === 'outline',
});

/** Canonical form used for duplicate detection: lowercase scheme/host, no fragment, no trailing slash. */
export function normalizeFeedUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.hash = '';
  return u.toString().replace(/\/$/, '');
}

function httpUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

type Outline = Record<string, unknown> & { outline?: Outline[] };

/** OPML attribute names vary in case (xmlUrl / xmlurl); look them up case-insensitively. */
function attr(node: Outline, name: string): string | undefined {
  const key = Object.keys(node).find((k) => k.toLowerCase() === name.toLowerCase());
  const value = key ? node[key] : undefined;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Parse an OPML document into a flat list of feeds. Nested folders are flattened into
 * "Parent / Child" category names. URLs already in `existingUrls` or repeated in the file
 * are returned in `duplicates`, never in `feeds`.
 */
export function parseOpml(xml: string, existingUrls: string[] = []): OpmlParseResult {
  const doc = parser.parse(xml) as { opml?: { body?: { outline?: Outline[] } } };
  if (!doc.opml) throw new Error('This file is not an OPML document.');

  const seen = new Set(existingUrls.map(normalizeFeedUrl));
  const result: OpmlParseResult = { feeds: [], duplicates: [], invalid: 0 };

  const walk = (outlines: Outline[], path: string[]) => {
    for (const node of outlines) {
      const rawUrl = attr(node, 'xmlUrl');
      const label = attr(node, 'title') ?? attr(node, 'text') ?? null;
      if (rawUrl === undefined) {
        if (node.outline) walk(node.outline, label ? [...path, label] : path);
        continue;
      }
      const url = httpUrl(rawUrl);
      if (!url) {
        result.invalid += 1;
        continue;
      }
      const feed: OpmlFeed = {
        url,
        title: label,
        siteUrl: httpUrl(attr(node, 'htmlUrl')),
        category: path.length ? path.join(' / ') : null,
      };
      const key = normalizeFeedUrl(url);
      if (seen.has(key)) {
        result.duplicates.push(feed);
      } else {
        seen.add(key);
        result.feeds.push(feed);
      }
    }
  };

  walk(doc.opml.body?.outline ?? [], []);
  return result;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function feedOutline(f: OpmlCategory['feeds'][number], indent: string): string {
  const site = f.siteUrl ? ` htmlUrl="${esc(f.siteUrl)}"` : '';
  return `${indent}<outline type="rss" text="${esc(f.title)}" title="${esc(f.title)}" xmlUrl="${esc(f.url)}"${site}/>`;
}

/** Serialize subscriptions to OPML 2.0, one folder per category, uncategorized feeds at the root. */
export function buildOpml(categories: OpmlCategory[], title = 'Frontpage subscriptions'): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    `  <head><title>${esc(title)}</title><dateCreated>${new Date().toUTCString()}</dateCreated></head>`,
    '  <body>',
  ];
  for (const cat of categories) {
    if (cat.name === null) {
      lines.push(...cat.feeds.map((f) => feedOutline(f, '    ')));
      continue;
    }
    lines.push(`    <outline text="${esc(cat.name)}" title="${esc(cat.name)}">`);
    lines.push(...cat.feeds.map((f) => feedOutline(f, '      ')));
    lines.push('    </outline>');
  }
  lines.push('  </body>', '</opml>', '');
  return lines.join('\n');
}
