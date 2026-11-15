import { XMLParser } from 'fast-xml-parser';
import { decodeHTML } from 'entities';
import sanitizeHtml from 'sanitize-html';

export type FeedFormat = 'rss2' | 'atom' | 'rdf';

export interface ParsedItem {
  guid: string;
  url: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
}

export interface ParsedFeed {
  format: FeedFormat;
  title: string;
  siteUrl: string | null;
  description: string | null;
  items: ParsedItem[];
}

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedParseError';
  }
}

const SUMMARY_MAX = 280;
const FULL_SUMMARY_MIN = 1000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ['item', 'entry', 'link', 'media:content', 'media:thumbnail', 'enclosure'].includes(name),
});

// ---------- encoding ----------

/** Decode raw feed bytes using, in order: BOM, HTTP charset, XML prolog, UTF-8. */
export function decodeFeedBytes(bytes: Uint8Array, contentType?: string | null): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
  const fromProlog = head.match(/<\?xml[^>]*encoding=["']([\w-]+)["']/i)?.[1];
  for (const label of [fromHeader, fromProlog, 'utf-8']) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(bytes);
    } catch {
      // unknown label: fall through to the next candidate
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

// ---------- dates ----------

const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** ISO 8601, RFC 822/2822 (incl. 2-digit years and US zone names); naive timestamps are read as UTC. */
export function parseDate(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const candidate = NAIVE_DATETIME.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const ms = Date.parse(candidate);
  if (Number.isNaN(ms)) return null;
  const year = new Date(ms).getUTCFullYear();
  return year >= 1990 && year <= 2100 ? new Date(ms) : null;
}

// ---------- text helpers ----------

/** Pull the text out of a parsed node: string, {#text}, or number. */
function text(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === 'string') return node.trim() || null;
  if (typeof node === 'number') return String(node);
  if (typeof node === 'object' && '#text' in node) return text((node as { '#text': unknown })['#text']);
  return null;
}

/** HTML fragment -> plain single-line text with entities decoded. */
export function toPlainText(html: string | null): string | null {
  if (!html) return null;
  const stripped = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  const plain = decodeHTML(stripped).replace(/\s+/g, ' ').trim();
  return plain || null;
}

function excerpt(html: string | null): string | null {
  const plain = toPlainText(html);
  if (!plain || plain.length <= SUMMARY_MAX) return plain;
  return `${plain.slice(0, SUMMARY_MAX).replace(/\s+\S*$/, '')}…`;
}

const READER_TAGS = [
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
  'pre', 'code', 'kbd', 'samp', 'em', 'strong', 'b', 'i', 'u', 's', 'sub', 'sup', 'mark',
  'a', 'img', 'figure', 'figcaption', 'picture', 'source', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'dl', 'dt', 'dd', 'abbr', 'cite', 'q', 'time', 'span', 'div',
];

/** Sanitize feed HTML for the reader view: content tags only, no scripts, styles, forms, trackers. */
export function sanitizeContent(html: string | null): string | null {
  if (!html) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: READER_TAGS,
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'width', 'height', 'srcset', 'sizes'],
      source: ['srcset', 'type', 'media'],
      code: ['class'],
      pre: ['class'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      time: ['datetime'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
      }),
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy', decoding: 'async' } }),
    },
    exclusiveFilter: (frame) =>
      // drop 1x1 tracking pixels (Medium, Substack, Feedburner)
      frame.tag === 'img' && (frame.attribs.width === '1' || frame.attribs.height === '1'),
  });
  return clean.trim() || null;
}

function firstImage(html: string | null): string | null {
  return html?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
}

function absolute(url: string | null, base: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url, base ?? undefined).toString();
  } catch {
    return null;
  }
}

type Node = Record<string, unknown>;
const asArray = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function mediaImage(item: Node): string | null {
  for (const key of ['media:content', 'media:thumbnail', 'enclosure'] as const) {
    for (const m of asArray(item[key] as Node[] | undefined)) {
      const url = text(m['@_url']);
      const type = text(m['@_type']) ?? '';
      const medium = text(m['@_medium']) ?? '';
      if (url && (key === 'media:thumbnail' || type.startsWith('image/') || medium === 'image')) return url;
    }
  }
  return null;
}

// ---------- format-specific mapping ----------

function buildItem(fields: {
  guid: string | null;
  url: string | null;
  title: string | null;
  summaryHtml: string | null;
  contentHtml: string | null;
  author: string | null;
  date: unknown;
  image: string | null;
  base: string | null;
}): ParsedItem {
  const url = absolute(fields.url, fields.base);
  // Many feeds (Simon Willison's Atom, a lot of RSS) ship the whole article in summary/description.
  const fullHtml =
    fields.contentHtml ??
    ((toPlainText(fields.summaryHtml)?.length ?? 0) > FULL_SUMMARY_MIN ? fields.summaryHtml : null);
  const content = sanitizeContent(fullHtml);
  const summary = excerpt(fields.summaryHtml) ?? excerpt(fields.contentHtml);
  const title = toPlainText(fields.title) ?? summary?.slice(0, 80) ?? 'Untitled';
  return {
    guid: fields.guid ?? url ?? `${title}-${text(fields.date) ?? ''}`,
    url,
    title,
    summary,
    content,
    author: toPlainText(fields.author),
    imageUrl: absolute(fields.image ?? firstImage(fields.contentHtml) ?? firstImage(fields.summaryHtml), url),
    publishedAt: parseDate(fields.date),
  };
}

function mapRss(channel: Node, items: Node[], format: 'rss2' | 'rdf'): ParsedFeed {
  const siteUrl = asArray(channel.link as unknown[]).map(text).find(Boolean) ?? null;
  return {
    format,
    title: toPlainText(text(channel.title)) ?? 'Untitled feed',
    siteUrl,
    description: toPlainText(text(channel.description)),
    items: items.map((it) => {
      const link = asArray(it.link as unknown[]).map(text).find(Boolean) ?? null;
      return buildItem({
        guid: text(it.guid) ?? text(it['@_rdf:about']),
        url: link,
        title: text(it.title),
        summaryHtml: text(it.description),
        contentHtml: text(it['content:encoded']),
        author: text(it['dc:creator']) ?? text(it.author),
        date: it.pubDate ?? it['dc:date'],
        image: mediaImage(it),
        base: siteUrl,
      });
    }),
  };
}

function atomLink(node: Node): string | null {
  const links = asArray(node.link as Node[] | undefined);
  const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
  return alt ? text(alt['@_href']) : null;
}

function mapAtom(feed: Node): ParsedFeed {
  const siteUrl = atomLink(feed);
  return {
    format: 'atom',
    title: toPlainText(text(feed.title)) ?? 'Untitled feed',
    siteUrl,
    description: toPlainText(text(feed.subtitle)),
    items: asArray(feed.entry as Node[] | undefined).map((e) =>
      buildItem({
        guid: text(e.id),
        url: atomLink(e),
        title: text(e.title),
        summaryHtml: text(e.summary),
        contentHtml: text(e.content),
        author: text((e.author as Node | undefined)?.name),
        date: e.published ?? e.updated,
        image: mediaImage(e),
        base: siteUrl,
      }),
    ),
  };
}

/** Parse RSS 2.0, Atom 1.0 or RSS 1.0/RDF. Tolerates truncated documents; throws FeedParseError when nothing feed-like is found. */
export function parseFeed(xml: string): ParsedFeed {
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch (err) {
    throw new FeedParseError(`Not valid XML: ${(err as Error).message}`);
  }

  const rss = doc.rss as Node | undefined;
  if (rss?.channel) {
    const channel = rss.channel as Node;
    return mapRss(channel, asArray(channel.item as Node[] | undefined), 'rss2');
  }
  const feed = doc.feed as Node | undefined;
  if (feed) return mapAtom(feed);
  const rdf = doc['rdf:RDF'] as Node | undefined;
  if (rdf?.channel) {
    return mapRss(rdf.channel as Node, asArray(rdf.item as Node[] | undefined), 'rdf');
  }
  throw new FeedParseError('This URL does not point to an RSS or Atom feed.');
}
