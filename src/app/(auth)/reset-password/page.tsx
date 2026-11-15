import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PASSWORD_MIN } from '@/lib/auth/validation';
import { resetPasswordAction } from '../actions';
import { AuthForm } from '../AuthForm';
import { FormSkeleton } from '../FormSkeleton';

export const metadata: Metadata = { title: 'Choose a new password', referrer: 'no-referrer' };

async function ResetForm({ searchParams }: { searchParams: PageProps<'/reset-password'>['searchParams'] }) {
  const { token } = await searchParams;
  if (typeof token !== 'string' || !token) {
    return (
      <p className="text-sm text-text-secondary">
        This page needs the link from your reset email.{' '}
        <Link href="/forgot-password" className="text-accent hover:underline">Ask for a new one</Link>.
      </p>
    );
  }
  return (
    <AuthForm
      action={resetPasswordAction}
      submitLabel="Update password"
      pendingLabel="Updating…"
      fields={[
        { name: 'token', label: '', type: 'hidden', defaultValue: token },
        {
          name: 'password',
          label: 'New password',
          type: 'password',
          autoComplete: 'new-password',
          required: true,
          hint: `At least ${PASSWORD_MIN} characters.`,
        },
      ]}
    />
  );
}

export default function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  return (
    <>
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-text-secondary">You will be signed out everywhere else.</p>
      <Suspense fallback={<FormSkeleton fields={1} />}>
        <ResetForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}
