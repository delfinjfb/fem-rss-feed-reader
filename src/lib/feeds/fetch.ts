import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { decodeFeedBytes, parseFeed, type ParsedFeed } from './parse';

export const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const BACKOFF_BASE_MS = 5 * 60_000;
const BACKOFF_CAP_MS = 24 * 60 * 60_000;
const STALE_AFTER_MS = 30 * 24 * 60 * 60_000;
const DEAD_AFTER_ERRORS = 5;
const USER_AGENT = 'FrontpageReader/1.0 (+https://github.com/; RSS aggregator)';

export type FeedHealth = 'active' | 'stale' | 'error' | 'dead';

export type FetchResult =
  | { kind: 'ok'; feed: ParsedFeed; etag: string | null; lastModified: string | null; finalUrl: string; movedPermanently: boolean }
  | { kind: 'not-modified' }
  | { kind: 'error'; message: string; permanent: boolean };

export class UnsafeUrlError extends Error {}

// ---------- SSRF guard ----------

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_V4: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
];

/** True for loopback, private, link-local, CGNAT, multicast and reserved ranges (v4 and v6). */
export function isPrivateAddress(ip: string): boolean {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (isIP(ip) === 4) {
    const n = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => (n >>> (32 - bits)) === (ipv4ToInt(base) >>> (32 - bits)));
  }
  const v6 = ip.toLowerCase();
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff');
}

/** Reject non-http(s) URLs and hosts that resolve to internal addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('That is not a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https feed URLs are supported.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new UnsafeUrlError(`Could not resolve ${host}.`);
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError('That address is not reachable from Frontpage.');
  }
  return url;
}

// ---------- scheduling / health ----------

/** Exponential backoff after `errorCount` consecutive failures: 5 min, 10, 20 ... capped at 24 h. */
export function nextFetchDelayMs(errorCount: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, errorCount - 1), BACKOFF_CAP_MS);
}

export function feedHealth(
  feed: { lastError: string | null; errorCount: number; latestItemAt: Date | null },
  now = new Date(),
): FeedHealth {
  if (feed.lastError) return feed.errorCount >= DEAD_AFTER_ERRORS ? 'dead' : 'error';
  if (feed.latestItemAt && now.getTime() - feed.latestItemAt.getTime() > STALE_AFTER_MS) return 'stale';
  return 'active';
}

// ---------- fetching ----------

async function readCapped(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error('Feed is larger than 5 MB.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

const PERMANENT_STATUSES = new Set([404, 410, 401, 403]);

/**
 * Fetch and parse one feed server-side. Redirects are followed by hand so every hop passes the
 * SSRF guard and a 301/308 chain can be reported back (the caller updates the stored URL).
 */
export async function fetchFeed(
  rawUrl: string,
  cache: { etag?: string | null; lastModified?: string | null } = {},
): Promise<FetchResult> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let current = rawUrl;
  let movedPermanently = true;
  let hops = 0;
  try {
    for (;;) {
      const url = await assertPublicUrl(current);
      const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
      };
      if (cache.etag) headers['If-None-Match'] = cache.etag;
      if (cache.lastModified) headers['If-Modified-Since'] = cache.lastModified;

      const res = await fetch(url, { headers, redirect: 'manual', signal });
      if (res.status >= 300 && res.status < 400 && res.status !== 304) {
        const location = res.headers.get('location');
        if (!location || ++hops > MAX_REDIRECTS) return { kind: 'error', message: 'Too many redirects.', permanent: true };
        if (res.status !== 301 && res.status !== 308) movedPermanently = false;
        current = new URL(location, url).toString();
        continue;
      }
      if (res.status === 304) return { kind: 'not-modified' };
      if (!res.ok) {
        return { kind: 'error', message: `The server answered HTTP ${res.status}.`, permanent: PERMANENT_STATUSES.has(res.status) };
      }
      const xml = decodeFeedBytes(await readCapped(res), res.headers.get('content-type'));
      return {
        kind: 'ok',
        feed: parseFeed(xml),
        etag: res.headers.get('etag'),
        lastModified: res.headers.get('last-modified'),
        finalUrl: current,
        movedPermanently: hops > 0 && movedPermanently,
      };
    }
  } catch (err) {
    const e = err as Error;
    if (e.name === 'TimeoutError') return { kind: 'error', message: 'The feed took longer than 10 seconds to answer.', permanent: false };
    if (e instanceof UnsafeUrlError) return { kind: 'error', message: e.message, permanent: true };
    if (e.name === 'FeedParseError') return { kind: 'error', message: e.message, permanent: true };
    return { kind: 'error', message: `Network error: ${e.message}`, permanent: false };
  }
}
