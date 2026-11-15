import { describe, expect, it } from 'vitest';
import { feedHealth, isPrivateAddress, nextFetchDelayMs } from './fetch';

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1'])(
    'blocks %s',
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(['8.8.8.8', '104.16.0.1', '2606:4700::1111', '172.32.0.1'])('allows %s', (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe('nextFetchDelayMs (exponential backoff)', () => {
  const MIN = 60_000;
  it('doubles from 5 minutes and caps at 24 hours', () => {
    expect(nextFetchDelayMs(1)).toBe(5 * MIN);
    expect(nextFetchDelayMs(2)).toBe(10 * MIN);
    expect(nextFetchDelayMs(3)).toBe(20 * MIN);
    expect(nextFetchDelayMs(20)).toBe(24 * 60 * MIN);
  });
});

describe('feedHealth', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const day = 86_400_000;
  it('is error when the last fetch failed', () => {
    expect(feedHealth({ lastError: 'HTTP 500', errorCount: 1, latestItemAt: now }, now)).toBe('error');
  });
  it('is dead after repeated permanent failures', () => {
    expect(feedHealth({ lastError: 'HTTP 404', errorCount: 5, latestItemAt: null }, now)).toBe('dead');
  });
  it('is stale when the newest item is 30+ days old', () => {
    expect(feedHealth({ lastError: null, errorCount: 0, latestItemAt: new Date(now.getTime() - 31 * day) }, now)).toBe('stale');
  });
  it('is active otherwise', () => {
    expect(feedHealth({ lastError: null, errorCount: 0, latestItemAt: new Date(now.getTime() - day) }, now)).toBe('active');
  });
});
