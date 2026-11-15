import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { itemsPage } from '@/lib/queries';
import { MAX_QUERY, selectionFromParams } from '@/lib/selection';
import { userFeedIdsFor } from '@/lib/user-dashboard';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const feedIds = await userFeedIdsFor(session.user.id, selectionFromParams(params));
  if (feedIds.length === 0) return NextResponse.json({ items: [], nextCursor: null });

  const page = await itemsPage(feedIds, {
    cursor: params.get('cursor'),
    q: params.get('q')?.slice(0, MAX_QUERY),
    userId: session.user.id,
  });
  return NextResponse.json(page, { headers: { 'Cache-Control': 'private, no-store' } });
}
