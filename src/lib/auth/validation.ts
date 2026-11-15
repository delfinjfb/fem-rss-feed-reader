import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email({ message: 'Enter a valid email address.' }));

// NIST SP 800-63B: at least 8 characters, no composition rules. bcrypt only reads 72 bytes, so cap there.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
const newPassword = z
  .string()
  .min(PASSWORD_MIN, { message: `Use at least ${PASSWORD_MIN} characters.` })
  .refine((p) => Buffer.byteLength(p) <= PASSWORD_MAX, { message: `Use at most ${PASSWORD_MAX} characters.` });

export const signUpSchema = z.object({
  email,
  password: newPassword,
  name: z.string().trim().max(80).optional(),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { message: 'Enter your password.' }).max(1024),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, { message: 'This reset link is invalid.' }),
  password: newPassword,
});

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** 32 random bytes for the email link; only the SHA-256 hash is stored. */
export function newResetToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

/** Only same-site absolute paths survive as a post-login redirect target. */
export function safeNextPath(raw: string | null | undefined, fallback = '/app'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}
