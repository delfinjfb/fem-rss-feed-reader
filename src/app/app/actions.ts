'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { refreshDueFeeds } from '@/lib/feeds/ingest';
import { ensureGuestFeeds, GUEST_CATEGORIES } from '@/lib/guest';

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session) throw new Error('Not signed in.');
  return session.user.id;
}

const readInput = z.object({ itemId: z.string().min(1).max(64), read: z.boolean() });

/** Mark one item read or unread. Only items from feeds the user subscribes to. */
export async function setItemReadAction(itemId: string, read: boolean): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const input = readInput.safeParse({ itemId, read });
  if (!input.success) return { ok: false };

  const item = await prisma.item.findFirst({
    where: { id: input.data.itemId, feed: { subscriptions: { some: { userId } } } },
    select: { id: true },
  });
  if (!item) return { ok: false };

  await prisma.readState.upsert({
    where: { userId_itemId: { userId, itemId: item.id } },
    create: { userId, itemId: item.id, read: input.data.read },
    update: { read: input.data.read, at: new Date() },
  });
  return { ok: true };
}

/** Quick start: subscribe to the 19 curated feeds in their 5 categories. Idempotent. */
export async function subscribeStarterPackAction(): Promise<void> {
  const userId = await requireUserId();
  const feeds = await ensureGuestFeeds();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.category.count({ where: { userId } });
    for (const [index, cat] of GUEST_CATEGORIES.entries()) {
      const category = await tx.category.upsert({
        where: { userId_name: { userId, name: cat.name } },
        create: { userId, name: cat.name, position: existing + index },
        update: {},
      });
      await tx.subscription.createMany({
        data: cat.feeds.flatMap((f) => {
          const feed = feeds.get(f.feedUrl);
          return feed ? [{ userId, feedId: feed.id, categoryId: category.id, customTitle: f.title }] : [];
        }),
        skipDuplicates: true,
      });
    }
  });

  // Mostly a no-op (guest feeds are kept warm by cron); covers a cold database.
  await refreshDueFeeds([...feeds.values()].map((f) => f.id));
  revalidatePath('/app');
}
