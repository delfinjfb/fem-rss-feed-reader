'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { allowAttempt } from '@/lib/auth/rate-limit';
import { prisma } from '@/lib/db';
import { refreshFeed } from '@/lib/feeds/ingest';
import { subscribeToUrl } from '@/lib/feeds/subscribe';
import { requireUser } from '@/lib/session';

export interface ActionState {
  error?: string;
  success?: string;
}

const id = z.string().min(1).max(64);
const categoryName = z.string().trim().min(1, { message: 'Give the category a name.' }).max(40, { message: 'Keep it under 40 characters.' });

const done = (message?: string): ActionState => {
  revalidatePath('/app', 'layout');
  return message ? { success: message } : {};
};

const NO_CATEGORY = '';

// ---------- feeds ----------

export async function addFeedAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser('/app/feeds');
  if (!(await allowAttempt('add-feed', user.id))) return { error: 'You added a lot of feeds quickly. Wait a few minutes.' };
  const categoryId = String(fd.get('categoryId') ?? NO_CATEGORY) || null;
  const result = await subscribeToUrl(user.id, String(fd.get('url') ?? ''), categoryId);
  if (!result.ok) return { error: result.error };
  return done(`Added ${result.title}${result.discovered ? ' (found from the site’s page)' : ''}.`);
}

export async function updateSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser('/app/feeds');
  const input = z
    .object({ subscriptionId: id, title: z.string().trim().max(80), categoryId: z.string().max(64) })
    .safeParse({ subscriptionId: fd.get('subscriptionId'), title: fd.get('title') ?? '', categoryId: fd.get('categoryId') ?? '' });
  if (!input.success) return { error: 'Check the title (80 characters at most).' };
  const { subscriptionId, title, categoryId } = input.data;

  if (categoryId && !(await prisma.category.findFirst({ where: { id: categoryId, userId: user.id }, select: { id: true } }))) {
    return { error: 'That category no longer exists.' };
  }
  const { count } = await prisma.subscription.updateMany({
    where: { id: subscriptionId, userId: user.id },
    data: { customTitle: title || null, categoryId: categoryId || null },
  });
  return count ? done('Saved.') : { error: 'Feed not found.' };
}

export async function removeSubscriptionAction(subscriptionId: string): Promise<ActionState> {
  const user = await requireUser('/app/feeds');
  if (!id.safeParse(subscriptionId).success) return { error: 'Feed not found.' };
  const sub = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId: user.id } });
  if (!sub) return { error: 'Feed not found.' };
  // The shared Feed and its items stay for other subscribers; this user's state on them goes.
  await prisma.$transaction([
    prisma.readState.deleteMany({ where: { userId: user.id, item: { feedId: sub.feedId } } }),
    prisma.bookmark.deleteMany({ where: { userId: user.id, item: { feedId: sub.feedId } } }),
    prisma.subscription.delete({ where: { id: sub.id } }),
  ]);
  return done();
}

export async function retryFeedAction(subscriptionId: string): Promise<ActionState> {
  const user = await requireUser('/app/feeds');
  if (!id.safeParse(subscriptionId).success) return { error: 'Feed not found.' };
  const sub = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId: user.id }, include: { feed: true } });
  if (!sub) return { error: 'Feed not found.' };
  if (!(await allowAttempt('add-feed', user.id))) return { error: 'Too many retries. Wait a few minutes.' };
  const outcome = await refreshFeed(sub.feed);
  return outcome.ok ? done(`Fetched. ${outcome.newItems} new article${outcome.newItems === 1 ? '' : 's'}.`) : done();
}

// ---------- categories ----------

export async function createCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser('/app/feeds');
  const name = categoryName.safeParse(fd.get('name'));
  if (!name.success) return { error: name.error.issues[0].message };
  const exists = await prisma.category.findUnique({ where: { userId_name: { userId: user.id, name: name.data } } });
  if (exists) return { error: `You already have a “${name.data}” category.` };
  const last = await prisma.category.aggregate({ where: { userId: user.id }, _max: { position: true } });
  await prisma.category.create({ data: { userId: user.id, name: name.data, position: (last._max.position ?? -1) + 1 } });
  return done(`Created ${name.data}.`);
}

export async function renameCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser('/app/feeds');
  const categoryId = id.safeParse(fd.get('categoryId'));
  const name = categoryName.safeParse(fd.get('name'));
  if (!categoryId.success) return { error: 'Category not found.' };
  if (!name.success) return { error: name.error.issues[0].message };
  const clash = await prisma.category.findFirst({
    where: { userId: user.id, name: name.data, id: { not: categoryId.data } },
    select: { id: true },
  });
  if (clash) return { error: `You already have a “${name.data}” category.` };
  const { count } = await prisma.category.updateMany({ where: { id: categoryId.data, userId: user.id }, data: { name: name.data } });
  return count ? done('Renamed.') : { error: 'Category not found.' };
}

/** Delete a category; its feeds move to Uncategorized (FK onDelete: SetNull). */
export async function deleteCategoryAction(categoryId: string): Promise<ActionState> {
  const user = await requireUser('/app/feeds');
  if (!id.safeParse(categoryId).success) return { error: 'Category not found.' };
  const { count } = await prisma.category.deleteMany({ where: { id: categoryId, userId: user.id } });
  return count ? done() : { error: 'Category not found.' };
}

/** Swap a category with its neighbour; positions are rewritten 0..n-1 to stay dense. */
export async function moveCategoryAction(categoryId: string, direction: 'up' | 'down'): Promise<ActionState> {
  const user = await requireUser('/app/feeds');
  const cats = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: { id: true },
  });
  const from = cats.findIndex((c) => c.id === categoryId);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= cats.length) return {};
  [cats[from], cats[to]] = [cats[to], cats[from]];
  await prisma.$transaction(cats.map((c, position) => prisma.category.update({ where: { id: c.id }, data: { position } })));
  return done();
}
