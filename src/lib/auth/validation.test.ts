import { describe, expect, it } from 'vitest';
import { hashToken, newResetToken, safeNextPath, signInSchema, signUpSchema } from './validation';

describe('signUpSchema', () => {
  it('normalizes the email and accepts a long passphrase', () => {
    const r = signUpSchema.safeParse({ email: '  Ada@Example.COM ', password: 'correct horse battery staple' });
    expect(r.success && r.data.email).toBe('ada@example.com');
  });
  it('rejects short passwords, overlong ones and bad emails', () => {
    expect(signUpSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
    expect(signUpSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(73) }).success).toBe(false);
    expect(signUpSchema.safeParse({ email: 'nope', password: 'longenough1' }).success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('does not apply length rules beyond presence (old passwords still sign in)', () => {
    expect(signInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('reset tokens', () => {
  it('creates 256-bit url-safe tokens and stores only their hash', () => {
    const { token, tokenHash } = newResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).not.toContain(token);
    expect(newResetToken().token).not.toBe(token);
  });
});

describe('safeNextPath (open-redirect guard)', () => {
  it.each([
    ['/app', '/app'],
    ['/app?x=1', '/app?x=1'],
    ['//evil.com', '/app'],
    ['https://evil.com', '/app'],
    ['/\\evil.com', '/app'],
    [null, '/app'],
  ])('%s -> %s', (input, out) => expect(safeNextPath(input)).toBe(out));
});
