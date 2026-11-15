import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpml, normalizeFeedUrl, parseOpml } from './opml';

const sample = readFileSync(path.join(process.cwd(), 'data/sample-feeds.opml'), 'utf8');

describe('parseOpml with the provided sample file', () => {
  const result = parseOpml(sample);

  it('finds the 19 curated feeds plus the dead one, each once', () => {
    expect(result.feeds).toHaveLength(20);
    expect(new Set(result.feeds.map((f) => f.url)).size).toBe(20);
  });

  it('flags the 5 edge-case entries that reuse a URL as duplicates', () => {
    expect(result.duplicates.map((d) => d.title)).toEqual([
      'Simon Willison',
      'web.dev (no type)',
      'CSS-Tricks (alt attr)',
      'Smashing (nested)',
      null,
    ]);
  });

  it('keeps categories and decodes entities in their names', () => {
    const cats = new Set(result.feeds.map((f) => f.category));
    expect(cats).toEqual(new Set(['Frontend', 'Design', 'Backend & DevOps', 'General Tech', 'AI & ML', null]));
  });

  it('marks feeds that are already subscribed as duplicates', () => {
    const r = parseOpml(sample, ['https://css-tricks.com/feed']);
    expect(r.feeds.find((f) => f.title === 'CSS-Tricks')).toBeUndefined();
    expect(r.duplicates.some((d) => d.title === 'CSS-Tricks')).toBe(true);
  });
});

describe('parseOpml edge cases', () => {
  it('reads lowercase attributes and flattens nested folders', () => {
    const r = parseOpml(`<opml><body><outline text="A"><outline text="B">
      <outline xmlurl="https://x.dev/feed" htmlurl="https://x.dev" text="X"/></outline></outline></body></opml>`);
    expect(r.feeds).toEqual([{ url: 'https://x.dev/feed', title: 'X', siteUrl: 'https://x.dev/', category: 'A / B' }]);
  });

  it('skips outlines whose url is not http(s)', () => {
    const r = parseOpml(`<opml><body><outline xmlUrl="javascript:alert(1)"/><outline xmlUrl="ftp://a/b"/></body></opml>`);
    expect(r.feeds).toEqual([]);
    expect(r.invalid).toBe(2);
  });

  it('rejects a file that is not OPML', () => {
    expect(() => parseOpml('<rss/>')).toThrow(/OPML/);
  });
});

describe('normalizeFeedUrl', () => {
  it('lowercases the host and drops the trailing slash and fragment', () => {
    expect(normalizeFeedUrl('HTTPS://CSS-Tricks.com/feed/#x')).toBe('https://css-tricks.com/feed');
  });
});

describe('buildOpml', () => {
  it('exports categories as folders, escaped, and round-trips', () => {
    const xml = buildOpml([
      { name: 'AI & ML', feeds: [{ title: 'Simon "W"', url: 'https://s.net/atom', siteUrl: null }] },
      { name: null, feeds: [{ title: 'Loose', url: 'https://l.dev/rss', siteUrl: 'https://l.dev/' }] },
    ]);
    expect(xml).toContain('text="AI &amp; ML"');
    expect(xml).toContain('Simon &quot;W&quot;');
    const back = parseOpml(xml);
    expect(back.feeds.map((f) => [f.category, f.url])).toEqual([
      ['AI & ML', 'https://s.net/atom'],
      [null, 'https://l.dev/rss'],
    ]);
  });
});
