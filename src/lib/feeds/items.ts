import type { ParsedItem } from './parse';

/** Most items kept from one fetch. Hugging Face ships 900+; nobody scrolls that far back. */
export const MAX_ITEMS_PER_FETCH = 100;

export interface ItemRow {
  feedId: string;
  guid: string;
  url: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
  sortDate: Date;
  hasContent: boolean;
}

/** Map parsed items to DB rows: dedupe guids, clamp sort dates to the fetch time, keep the newest N. */
export function toItemRows(feedId: string, items: ParsedItem[], now: Date, limit = MAX_ITEMS_PER_FETCH): ItemRow[] {
  const seen = new Set<string>();
  const rows: ItemRow[] = [];
  for (const it of items) {
    if (seen.has(it.guid)) continue;
    seen.add(it.guid);
    const published = it.publishedAt && it.publishedAt <= now ? it.publishedAt : null;
    rows.push({ feedId, ...it, sortDate: published ?? now, hasContent: it.content !== null });
  }
  rows.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
  return rows.slice(0, limit);
}

export interface Cursor {
  sortDate: Date;
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.sortDate.toISOString()}|${c.id}`).toString('base64url');
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  const [iso, id] = Buffer.from(raw, 'base64url').toString().split('|');
  const sortDate = new Date(iso);
  return id && !Number.isNaN(sortDate.getTime()) ? { sortDate, id } : null;
}

export function faviconFor(siteUrl: string | null): string | null {
  if (!siteUrl) return null;
  try {
    return new URL('/favicon.ico', siteUrl).toString();
  } catch {
    return null;
  }
}
