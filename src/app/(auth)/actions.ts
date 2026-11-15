'use server';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { signIn, signOut } from '@/auth';
import { allowAttempt, clientIp } from '@/lib/auth/rate-limit';
import { forgotSchema, newResetToken, hashToken, resetSchema, safeNextPath, signInSchema, signUpSchema } from '@/lib/auth/validation';
import { prisma } from '@/lib/db';
import { sendMail } from '@/lib/mail';

const BCRYPT_COST = 12;
const RESET_TTL_MS = 30 * 60_000;
const TOO_MANY = 'Too many attempts. Wait a few minutes and try again.';

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  values?: Record<string, string>;
}

const fields = (fd: FormData, ...names: string[]) =>
  Object.fromEntries(names.map((n) => [n, String(fd.get(n) ?? '')]));

const fieldErrors = (err: z.ZodError) => z.flattenError(err).fieldErrors as Record<string, string[] | undefined>;

/** Absolute base URL for links in emails. Never derived from the Host header (spoofable). */
function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}

export async function signUpAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = fields(fd, 'email', 'name');
  const parsed = signUpSchema.safeParse(fields(fd, 'email', 'password', 'name'));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if (!(await allowAttempt('sign-up', await clientIp()))) return { error: TOO_MANY, values };

  const { email, password, name } = parsed.data;
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { fieldErrors: { email: ['An account with this email already exists. Sign in instead.'] }, values };
  }
  await prisma.user.create({
    data: { email, name: name || null, passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
  });
  await signIn('credentials', { email, password, redirectTo: '/app?welcome=1' });
  return {};
}

export async function signInAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = fields(fd, 'email');
  const parsed = signInSchema.safeParse(fields(fd, 'email', 'password'));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if (!(await allowAttempt('sign-in', await clientIp()))) return { error: TOO_MANY, values };

  try {
    await signIn('credentials', {
      ...parsed.data,
      redirectTo: safeNextPath(String(fd.get('next') ?? '')),
    });
  } catch (err) {
    // signIn redirects by throwing; only Auth.js errors are ours to turn into a message.
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      return { error: code === 'rate_limited' ? TOO_MANY : 'Email or password is incorrect.', values };
    }
    throw err;
  }
  return {};
}

export async function forgotPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = fields(fd, 'email');
  const parsed = forgotSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { email } = parsed.data;
  if (!(await allowAttempt('forgot', await clientIp())) || !(await allowAttempt('forgot', email))) {
    return { error: TOO_MANY, values };
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    const { token, tokenHash } = newResetToken();
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      }),
    ]);
    await sendMail({
      to: email,
      subject: 'Reset your Frontpage password',
      text: [
        'Someone asked to reset the password of your Frontpage account.',
        '',
        `Choose a new password here (the link works once, for 30 minutes):`,
        `${appUrl()}/reset-password?token=${token}`,
        '',
        'If it was not you, ignore this email: your password stays the same.',
      ].join('\n'),
    });
  }
  // Same answer whether or not the account exists: the form must not reveal who is registered.
  return { message: 'If an account exists for that email, a reset link is on its way. Check your inbox.' };
}

export async function resetPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(fields(fd, 'token', 'password'));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!(await allowAttempt('reset', await clientIp()))) return { error: TOO_MANY };

  const { token, password } = parsed.data;
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: 'This reset link has expired or was already used. Ask for a new one.' };
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_COST), sessionVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } }),
  ]);
  redirect('/sign-in?reset=1');
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
