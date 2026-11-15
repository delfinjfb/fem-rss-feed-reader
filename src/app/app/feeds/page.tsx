import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AddFeedForm } from '@/components/feeds/AddFeedForm';
import { CategoryManager } from '@/components/feeds/CategoryManager';
import { FeedRow, type ManagedFeed } from '@/components/feeds/FeedRow';
import { HealthSummary } from '@/components/feeds/HealthSummary';
import { prisma } from '@/lib/db';
import { feedHealth } from '@/lib/feeds/fetch';
import { feedStats } from '@/lib/queries';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Manage feeds' };

export default async function FeedsPage() {
  const user = await requireUser('/app/feeds');
  const [categories, subs] = await Promise.all([
    prisma.category.findMany({ where: { userId: user.id }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    prisma.subscription.findMany({ where: { userId: user.id }, include: { feed: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  const stats = await feedStats(subs.map((s) => s.feedId));

  const feeds: ManagedFeed[] = subs.map((s) => {
    const st = stats.get(s.feedId);
    return {
      subscriptionId: s.id,
      categoryId: s.categoryId,
      title: s.customTitle ?? s.feed.title,
      originalTitle: s.feed.title,
      url: s.feed.url,
      siteUrl: s.feed.siteUrl,
      description: s.feed.description,
      iconUrl: s.feed.iconUrl,
      itemCount: st?.count ?? 0,
      lastSuccessAt: s.feed.lastSuccessAt?.toISOString() ?? null,
      lastError: s.feed.lastError,
      health: feedHealth({ lastError: s.feed.lastError, errorCount: s.feed.errorCount, latestItemAt: st?.latest ?? null }),
    };
  });
  const options = categories.map((c) => ({ id: c.id, name: c.name }));
  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, feeds: feeds.filter((f) => f.categoryId === c.id) })),
    { id: 'uncategorized', name: 'Uncategorized', feeds: feeds.filter((f) => f.categoryId === null) },
  ].filter((g) => g.feeds.length > 0);

  return (
    <main className="mx-auto flex max-w-[var(--container-feed)] flex-col gap-10 px-4 py-8 sm:px-6">
      <div>
        <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} aria-hidden="true" /> Back to reading
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Manage feeds</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {feeds.length} feed{feeds.length === 1 ? '' : 's'} in {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}.
        </p>
      </div>

      <HealthSummary feeds={feeds} />

      <section aria-labelledby="add-heading" className="rounded-lg border border-border p-5">
        <h2 id="add-heading" className="text-lg font-semibold">Add a feed</h2>
        <p className="mb-4 mt-1 text-sm text-text-secondary">
          Paste a feed URL or just the website address: Frontpage finds the feed it advertises.
        </p>
        <AddFeedForm categories={options} />
      </section>

      <CategoryManager categories={categories.map((c) => ({ ...c, feedCount: feeds.filter((f) => f.categoryId === c.id).length }))} />

      <section aria-labelledby="feeds-heading" className="flex flex-col gap-6">
        <h2 id="feeds-heading" className="text-lg font-semibold">Your feeds</h2>
        {groups.length === 0 && <p className="text-sm text-text-secondary">No feeds yet. Add one above.</p>}
        {groups.map((g) => (
          <div key={g.id}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-tertiary">{g.name}</h3>
            <ul className="divide-y divide-border-subtle rounded-lg border border-border">
              {g.feeds.map((f) => (
                <FeedRow key={f.subscriptionId} feed={f} categories={options} />
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
