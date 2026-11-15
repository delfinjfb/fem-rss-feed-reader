import { NextResponse, type NextRequest } from 'next/server';
import { feedIdsFor, guestNavigation } from '@/lib/guest-dashboard';
import { itemsPage } from '@/lib/queries';
import type { Selection } from '@/lib/types';

const MAX_QUERY = 200;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const feed = params.get('feed');
  const category = params.get('category');
  const selection: Selection = feed
    ? { kind: 'feed', id: feed }
    : category
      ? { kind: 'category', id: category }
      : { kind: 'all' };

  const { categories } = await guestNavigation();
  const feedIds = feedIdsFor(selection, categories);
  if (feedIds.length === 0) return NextResponse.json({ error: 'Unknown feed or category.' }, { status: 404 });

  const page = await itemsPage(feedIds, {
    cursor: params.get('cursor'),
    q: params.get('q')?.slice(0, MAX_QUERY),
  });
  return NextResponse.json(page, { headers: { 'Cache-Control': 'private, max-age=30' } });
}
