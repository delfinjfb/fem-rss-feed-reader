import { signOutAction } from '@/app/(auth)/actions';
import { subscribeStarterPackAction } from '@/app/app/actions';
import { GUEST_CATEGORIES } from '@/lib/guest';
import { SubmitButton } from './SubmitButton';

/** Empty state for a new account: one click to a populated dashboard. */
export function StarterPack({ name }: { name: string | null }) {
  const total = GUEST_CATEGORIES.reduce((n, c) => n + c.feeds.length, 0);
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <p className="text-sm font-semibold text-accent">Welcome{name ? `, ${name}` : ''}</p>
      <h1 className="text-2xl font-bold tracking-tight">Your front page is empty. Let’s fill it.</h1>
      <p className="text-base text-text-secondary">
        Start with our starter pack of {total} well-kept feeds about building for the web. You can remove any of
        them, rename them or add your own later.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {GUEST_CATEGORIES.map((cat) => (
          <li key={cat.name} className="rounded-lg border border-border bg-bg-secondary p-4">
            <p className="font-semibold">{cat.name}</p>
            <p className="mt-1 text-sm text-text-secondary">{cat.feeds.map((f) => f.title).join(', ')}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4">
        <form action={subscribeStarterPackAction}>
          <SubmitButton pendingLabel="Adding feeds…">Add the starter pack</SubmitButton>
        </form>
        <form action={signOutAction}>
          <button type="submit" className="text-sm text-text-secondary underline-offset-2 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
