import type { Selection } from '@/lib/types';

/** Parse ?feed= / ?category= into a Selection (no param = all articles). */
export function selectionFromParams(params: URLSearchParams): Selection {
  const feed = params.get('feed');
  const category = params.get('category');
  if (feed) return { kind: 'feed', id: feed };
  if (category) return { kind: 'category', id: category };
  return { kind: 'all' };
}

export const MAX_QUERY = 200;
