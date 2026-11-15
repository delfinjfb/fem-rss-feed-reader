import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, faviconFor, toItemRows } from './items';
import type { ParsedItem } from './parse';

const base: ParsedItem = {
  guid: 'g',
  url: 'https://a.dev/1',
  title: 'T',
  summary: null,
  content: null,
  author: null,
  imageUrl: null,
  publishedAt: null,
};

describe('toItemRows', () => {
  const now = new Date('2026-11-15T12:00:00Z');

  it('keeps the newest N items, newest first', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      ...base,
      guid: `g${i}`,
      publishedAt: new Date(Date.UTC(2026, 0, i + 1)),
    }));
    const rows = toItemRows('f1', items, now, 3);
    expect(rows.map((r) => r.guid)).toEqual(['g4', 'g3', 'g2']);
    expect(rows[0].feedId).toBe('f1');
  });

  it('uses fetch time as sortDate for undated or future-dated items', () => {
    const rows = toItemRows('f1', [
      { ...base, guid: 'none' },
      { ...base, guid: 'future', publishedAt: new Date('2030-01-01T00:00:00Z') },
    ], now);
    expect(rows.every((r) => r.sortDate.getTime() === now.getTime())).toBe(true);
  });

  it('drops repeated guids inside one fetch', () => {
    expect(toItemRows('f1', [base, { ...base, title: 'again' }], now)).toHaveLength(1);
  });
});

describe('cursor', () => {
  it('round-trips and rejects garbage', () => {
    const c = encodeCursor({ sortDate: new Date('2026-01-02T03:04:05Z'), id: 'abc' });
    expect(decodeCursor(c)).toEqual({ sortDate: new Date('2026-01-02T03:04:05Z'), id: 'abc' });
    expect(decodeCursor('nope')).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });
});

describe('faviconFor', () => {
  it('points at the site origin favicon', () => {
    expect(faviconFor('https://blog.cloudflare.com/some/path')).toBe('https://blog.cloudflare.com/favicon.ico');
    expect(faviconFor(null)).toBeNull();
  });
});
