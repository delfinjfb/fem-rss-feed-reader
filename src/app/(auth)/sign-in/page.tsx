import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/auth';
import { safeNextPath } from '@/lib/auth/validation';
import { signInAction } from '../actions';
import { AuthForm } from '../AuthForm';
import { FormSkeleton } from '../FormSkeleton';

export const metadata: Metadata = { title: 'Sign in' };

/** Request-time part: reads the session and the query string, so it streams inside Suspense. */
async function SignInForm({ searchParams }: { searchParams: PageProps<'/sign-in'>['searchParams'] }) {
  await connection();
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null);
  if (await auth()) redirect(next);
  return (
    <>
      {params.reset === '1' && (
        <p role="status" className="mb-4 rounded-md bg-accent-subtle p-3 text-sm">
          Password updated. Sign in with your new password.
        </p>
      )}
      <AuthForm
        action={signInAction}
        submitLabel="Sign in"
        pendingLabel="Signing in…"
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', required: true },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password', required: true },
          { name: 'next', label: '', type: 'hidden', defaultValue: next },
        ]}
      />
    </>
  );
}

export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  return (
    <>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mb-6 mt-1 text-sm text-text-secondary">Welcome back. Your feeds are waiting.</p>
      <Suspense fallback={<FormSkeleton />}>
        <SignInForm searchParams={searchParams} />
      </Suspense>
      <div className="mt-6 flex flex-col gap-2 text-sm">
        <Link href="/forgot-password" className="text-accent hover:underline">Forgot your password?</Link>
        <p className="text-text-secondary">
          New here? <Link href="/sign-up" className="font-medium text-accent hover:underline">Create an account</Link>
          {' '}or <Link href="/guest" className="font-medium text-accent hover:underline">try as guest</Link>.
        </p>
      </div>
    </>
  );
}
