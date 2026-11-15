import { describe, expect, it } from 'vitest';
import { decodeFeedBytes, FeedParseError, parseDate, parseFeed } from './parse';

const rss2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Tips &amp; Tricks</title>
  <link>https://example.com/</link>
  <description>A blog</description>
  <item>
    <title>It&#8217;s CSS &mdash; again</title>
    <link>https://example.com/a</link>
    <guid isPermaLink="false">a-1</guid>
    <pubDate>Mon, 15 Jan 2024 10:30:00 GMT</pubDate>
    <dc:creator><![CDATA[Ada]]></dc:creator>
    <description><![CDATA[<p>Short <b>summary</b></p>]]></description>
    <content:encoded><![CDATA[<h2>Full</h2><p>Body</p><script>alert(1)</script>]]></content:encoded>
  </item>
  <item>
    <title>No date, no guid</title>
    <link>https://example.com/b</link>
  </item>
</channel>
</rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Atom Blog</title>
  <link href="https://atom.example/" rel="alternate"/>
  <link href="https://atom.example/feed.xml" rel="self"/>
  <entry>
    <title type="html">Hello &lt;em&gt;Atom&lt;/em&gt;</title>
    <id>tag:atom.example,2024:1</id>
    <link rel="alternate" href="https://atom.example/1"/>
    <updated>2024-01-15T10:30:00Z</updated>
    <author><name>Simon</name></author>
    <summary>Sum</summary>
    <content type="html">&lt;p&gt;Full &lt;img src="https://atom.example/x.png"&gt;&lt;/p&gt;</content>
  </entry>
</feed>`;

const rdf = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://rdf.example/"><title>RDF Feed</title><link>https://rdf.example/</link><description>d</description></channel>
  <item rdf:about="https://rdf.example/1"><title>One</title><link>https://rdf.example/1</link><dc:date>2024-01-15T10:30:00+01:00</dc:date></item>
</rdf:RDF>`;

describe('parseFeed', () => {
  it('parses RSS 2.0 with entities, CDATA, content:encoded and missing fields', () => {
    const f = parseFeed(rss2);
    expect(f.format).toBe('rss2');
    expect(f.title).toBe('Tips & Tricks');
    expect(f.siteUrl).toBe('https://example.com/');
    expect(f.items).toHaveLength(2);
    const [a, b] = f.items;
    expect(a.title).toBe('It’s CSS — again');
    expect(a.guid).toBe('a-1');
    expect(a.author).toBe('Ada');
    expect(a.publishedAt?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    expect(a.summary).toBe('Short summary');
    expect(a.content).toContain('<h2>Full</h2>');
    expect(a.content).not.toContain('script');
    expect(b.guid).toBe('https://example.com/b');
    expect(b.publishedAt).toBeNull();
    expect(b.summary).toBeNull();
  });

  it('parses Atom 1.0 with alternate links and html content', () => {
    const f = parseFeed(atom);
    expect(f.format).toBe('atom');
    expect(f.siteUrl).toBe('https://atom.example/');
    const [e] = f.items;
    expect(e.title).toBe('Hello Atom');
    expect(e.url).toBe('https://atom.example/1');
    expect(e.author).toBe('Simon');
    expect(e.imageUrl).toBe('https://atom.example/x.png');
    expect(e.content).toContain('<p>');
  });

  it('treats a long HTML summary as full content when no content element exists', () => {
    const long = '&lt;p&gt;' + 'word '.repeat(300) + '&lt;/p&gt;';
    const f = parseFeed(atom.replace(/<summary>Sum<\/summary>\s*<content[^]*?<\/content>/, `<summary type="html">${long}</summary>`));
    expect(f.items[0].content).toMatch(/^<p>word/);
    expect(f.items[0].summary!.length).toBeLessThanOrEqual(281);
  });

  it('parses RSS 1.0 / RDF', () => {
    const f = parseFeed(rdf);
    expect(f.format).toBe('rdf');
    expect(f.title).toBe('RDF Feed');
    expect(f.items[0].publishedAt?.toISOString()).toBe('2024-01-15T09:30:00.000Z');
  });

  it('throws a clear error for non-feed or fully broken XML', () => {
    expect(() => parseFeed('<html><body>Not a feed</body></html>')).toThrow(FeedParseError);
    expect(() => parseFeed('this is not xml at all')).toThrow(FeedParseError);
  });

  it('keeps parsing a feed whose last item is truncated', () => {
    const broken = rss2.replace('</channel>\n</rss>', '<item><title>Cut');
    const f = parseFeed(broken);
    expect(f.items.length).toBeGreaterThanOrEqual(2);
  });
});

describe('parseDate', () => {
  it.each([
    ['2024-01-15T10:30:00Z', '2024-01-15T10:30:00.000Z'],
    ['Mon, 15 Jan 2024 10:30:00 GMT', '2024-01-15T10:30:00.000Z'],
    ['Mon, 15 Jan 2024 10:30:00 +0200', '2024-01-15T08:30:00.000Z'],
    ['15 Jan 2024 10:30:00 EST', '2024-01-15T15:30:00.000Z'],
    ['Mon, 15 Jan 24 10:30:00 PDT', '2024-01-15T17:30:00.000Z'],
    ['2024-01-15 10:30:00', '2024-01-15T10:30:00.000Z'],
  ])('%s', (input, iso) => {
    expect(parseDate(input)?.toISOString()).toBe(iso);
  });

  it('returns null for garbage or empty', () => {
    expect(parseDate('yesterday-ish')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe('decodeFeedBytes', () => {
  it('honours the XML prolog encoding (windows-1252)', () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('<?xml version="1.0" encoding="windows-1252"?><t>caf'),
      0xe9, 0x20, 0x93, 0x71, 0x94,
      ...new TextEncoder().encode('</t>'),
    ]);
    expect(decodeFeedBytes(bytes)).toContain('café “q”');
  });

  it('prefers the Content-Type charset (ISO-8859-1)', () => {
    const bytes = new Uint8Array([0x3c, 0x74, 0x3e, 0xe9, 0x3c, 0x2f, 0x74, 0x3e]);
    expect(decodeFeedBytes(bytes, 'application/rss+xml; charset=ISO-8859-1')).toBe('<t>é</t>');
  });

  it('strips a UTF-8 BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('<t/>')]);
    expect(decodeFeedBytes(bytes)).toBe('<t/>');
  });
});
