import type { Metadata } from 'next';
import Link from 'next/link';
import { PASSWORD_MIN } from '@/lib/auth/validation';
import { signUpAction } from '../actions';
import { AuthForm } from '../AuthForm';

export const metadata: Metadata = { title: 'Create your account' };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-text-secondary">
        Keep your feeds, read state and bookmarks in sync across devices. Free.
      </p>
      <AuthForm
        action={signUpAction}
        submitLabel="Create account"
        pendingLabel="Creating your account…"
        fields={[
          { name: 'name', label: 'Name (optional)', autoComplete: 'name' },
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', required: true },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            autoComplete: 'new-password',
            required: true,
            hint: `At least ${PASSWORD_MIN} characters. A passphrase works well.`,
          },
        ]}
      />
      <p className="mt-6 text-sm text-text-secondary">
        Already have an account? <Link href="/sign-in" className="font-medium text-accent hover:underline">Sign in</Link>
      </p>
    </>
  );
}
