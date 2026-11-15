import type { FeedHealth } from '@/lib/types';

const LABELS: { key: FeedHealth; label: string; dot: string }[] = [
  { key: 'active', label: 'Healthy', dot: 'bg-success' },
  { key: 'stale', label: 'Quiet 30+ days', dot: 'bg-warning' },
  { key: 'error', label: 'Last fetch failed', dot: 'bg-error' },
  { key: 'dead', label: 'Failing repeatedly', dot: 'bg-error' },
];

export function HealthSummary({ feeds }: { feeds: { health: FeedHealth }[] }) {
  return (
    <section aria-labelledby="health-heading">
      <h2 id="health-heading" className="sr-only">Feed health</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LABELS.map(({ key, label, dot }) => (
          <div key={key} className="rounded-lg border border-border bg-bg-secondary p-4">
            <dt className="flex items-center gap-2 text-xs text-text-secondary">
              <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
              {label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{feeds.filter((f) => f.health === key).length}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
