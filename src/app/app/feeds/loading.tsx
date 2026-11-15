export default function Loading() {
  return (
    <main aria-busy="true" className="mx-auto flex max-w-[var(--container-feed)] flex-col gap-10 px-4 py-8 sm:px-6">
      <p className="sr-only" role="status">Loading your feeds…</p>
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-3">
        <div className="h-4 w-28 rounded bg-bg-tertiary" />
        <div className="h-8 w-56 rounded bg-bg-tertiary" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-lg bg-bg-tertiary" />)}
        </div>
        <div className="h-40 rounded-lg bg-bg-tertiary" />
      </div>
    </main>
  );
}
