import type { Metadata } from 'next';
import { after, connection } from 'next/server';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { refreshDueFeeds } from '@/lib/feeds/ingest';
import { guestNavigation } from '@/lib/guest-dashboard';
import { itemsPage } from '@/lib/queries';

export const metadata: Metadata = { title: 'Guest dashboard' };
// First visit may fetch 19 feeds (10 s timeout each, 6 at a time).
export const maxDuration = 60;
const COLD_START_BUDGET_MS = 4000;

export default async function GuestPage() {
  await connection(); // always render per request: content comes from the DB, not the build

  let nav = await guestNavigation();
  const neverFetched = nav.categories.flatMap((c) => c.feeds).filter((f) => f.lastSuccessAt === null && f.lastError === null);
  if (neverFetched.length) {
    // Cold start (normally prevented by the cron warm-up): wait for real content, but at most
    // COLD_START_BUDGET_MS. Feeds still loading finish in the background via after().
    const firstFetch = refreshDueFeeds(neverFetched.map((f) => f.id));
    await Promise.race([firstFetch, new Promise((resolve) => setTimeout(resolve, COLD_START_BUDGET_MS))]);
    after(() => firstFetch);
    nav = await guestNavigation();
  } else {
    // Warm path: refresh due feeds once the page has been sent.
    after(() => refreshDueFeeds(nav.feedIds));
  }

  const firstPage = await itemsPage(nav.feedIds);
  return <Dashboard mode="guest" categories={nav.categories} initialPage={firstPage} />;
}
