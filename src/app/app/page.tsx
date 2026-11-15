import type { Metadata } from 'next';
import { after } from 'next/server';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { StarterPack } from '@/components/dashboard/StarterPack';
import { refreshDueFeeds } from '@/lib/feeds/ingest';
import { itemsPage } from '@/lib/queries';
import { requireUser } from '@/lib/session';
import { userNavigation } from '@/lib/user-dashboard';

export const metadata: Metadata = { title: 'Your front page' };

export default async function AppPage() {
  const user = await requireUser('/app');
  const userId = user.id;

  const nav = await userNavigation(userId);
  if (nav.feedIds.length === 0) return <StarterPack name={user.name ?? null} />;

  after(() => refreshDueFeeds(nav.feedIds));
  const firstPage = await itemsPage(nav.feedIds, { userId });
  return (
    <Dashboard
      mode="user"
      user={{ email: user.email, name: user.name ?? null }}
      categories={nav.categories}
      initialPage={firstPage}
    />
  );
}
