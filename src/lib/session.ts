import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/auth';

/** Session of the signed-in user, or a redirect to sign-in that returns here afterwards. */
export async function requireUser(returnTo: string) {
  await connection(); // session checks are per request, never prerendered
  const session = await auth();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return session.user;
}
