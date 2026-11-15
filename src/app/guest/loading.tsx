import { ListSkeleton } from '@/components/dashboard/ItemList';

export default function Loading() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--spacing-sidebar)_1fr]" aria-busy="true">
      <div className="hidden border-r border-border bg-bg-secondary lg:block" />
      <div>
        <div className="h-[3.75rem] border-b border-border" />
        <p className="sr-only" role="status">Loading your guest dashboard…</p>
        <div className="mx-auto max-w-[var(--container-feed)]">
          <ListSkeleton />
        </div>
      </div>
    </div>
  );
}
