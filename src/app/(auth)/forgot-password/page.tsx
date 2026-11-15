import type { Metadata } from 'next';
import Link from 'next/link';
import { forgotPasswordAction } from '../actions';
import { AuthForm } from '../AuthForm';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-text-secondary">
        Enter your account email and we will send you a link to choose a new password.
      </p>
      <AuthForm
        action={forgotPasswordAction}
        submitLabel="Send reset link"
        pendingLabel="Sending…"
        fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email', required: true }]}
      />
      <p className="mt-6 text-sm">
        <Link href="/sign-in" className="text-accent hover:underline">Back to sign in</Link>
      </p>
    </>
  );
}
