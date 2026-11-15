import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: {} }));
const { normalizeInputUrl } = await import('./subscribe');

describe('normalizeInputUrl', () => {
  it.each([
    ['css-tricks.com/feed', 'https://css-tricks.com/feed'],
    ['  https://Example.com/rss.xml ', 'https://example.com/rss.xml'],
    ['http://a.dev', 'http://a.dev/'],
  ])('%s -> %s', (input, out) => expect(normalizeInputUrl(input)).toBe(out));

  it.each(['', 'javascript:alert(1)', 'ftp://a/b', 'file:///etc/passwd', 'x'.repeat(3000)])('rejects %s', (input) =>
    expect(normalizeInputUrl(input)).toBeNull(),
  );
});
