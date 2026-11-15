import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--container-page)] flex-col justify-center gap-6 px-4 py-16 sm:px-8">
      <p className="text-sm font-semibold text-accent">Frontpage</p>
      <h1 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
        All your feeds on one calm page.
      </h1>
      <p className="max-w-xl text-base text-text-secondary">
        Frontpage pulls the RSS and Atom feeds you follow into a single reading dashboard: organised by
        category, searchable, and quiet.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/sign-up" className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover">
          Sign up free
        </Link>
        <Link
          href="/guest"
          className="rounded-md border border-border px-5 py-3 text-sm font-semibold text-text-primary hover:bg-bg-tertiary"
        >
          Try as guest
        </Link>
      </div>
    </main>
  );
}
