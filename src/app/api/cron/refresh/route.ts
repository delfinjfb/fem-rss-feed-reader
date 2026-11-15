import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { refreshDueFeeds } from '@/lib/feeds/ingest';
import { ensureGuestFeeds } from '@/lib/guest';

export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  return Boolean(secret) && header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/** Vercel Cron (see vercel.json): refresh every feed that is due, guest feeds included. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureGuestFeeds();
  const ids = (await prisma.feed.findMany({ select: { id: true } })).map((f) => f.id);
  const outcomes = await refreshDueFeeds(ids);
  return NextResponse.json({
    refreshed: outcomes.length,
    failed: outcomes.filter((o) => !o.ok).length,
    newItems: outcomes.reduce((n, o) => n + o.newItems, 0),
  });
}
