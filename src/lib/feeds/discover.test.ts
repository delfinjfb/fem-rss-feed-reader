import { describe, expect, it } from 'vitest';
import { discoverFeedLinks, looksLikeHtml } from './discover';

describe('discoverFeedLinks', () => {
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="/style.css">
    <link rel="alternate" type="application/rss+xml" title="Main feed" href="/feed/">
    <link type="application/atom+xml" rel="alternate" href="https://cdn.example.com/atom.xml" title="Atom">
    <link rel="alternate" type="application/rss+xml" href="/feed/">
    <link rel="alternate" type="application/json" href="/feed.json">
    <link rel="alternate" hreflang="fr" href="/fr/">
  </head><body><a href="/rss">RSS</a></body></html>`;

  it('returns RSS and Atom alternates, resolved and deduplicated, in page order', () => {
    expect(discoverFeedLinks(html, 'https://example.com/blog/')).toEqual([
      { url: 'https://example.com/feed/', title: 'Main feed' },
      { url: 'https://cdn.example.com/atom.xml', title: 'Atom' },
    ]);
  });

  it('ignores non-http schemes and returns [] when nothing is advertised', () => {
    expect(discoverFeedLinks('<link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">', 'https://a.dev')).toEqual([]);
    expect(discoverFeedLinks('<p>no feeds</p>', 'https://a.dev')).toEqual([]);
  });
});

describe('looksLikeHtml', () => {
  it('detects HTML documents but not feeds', () => {
    expect(looksLikeHtml('  <!DOCTYPE html><html>')).toBe(true);
    expect(looksLikeHtml('<html lang="en">')).toBe(true);
    expect(looksLikeHtml('<?xml version="1.0"?><rss>')).toBe(false);
  });
});
