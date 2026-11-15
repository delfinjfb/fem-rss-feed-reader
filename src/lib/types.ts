// Shapes shared by server queries and client components. Dates travel as ISO strings.

export type FeedHealth = 'active' | 'stale' | 'error' | 'dead';

export interface NavFeed {
  id: string;
  title: string;
  siteUrl: string | null;
  iconUrl: string | null;
  health: FeedHealth;
  lastSuccessAt: string | null;
  lastError: string | null;
  itemCount: number;
  unreadCount: number;
}

export interface NavCategory {
  id: string;
  name: string;
  feeds: NavFeed[];
}

export interface ItemDTO {
  id: string;
  feedId: string;
  title: string;
  url: string | null;
  summary: string | null;
  imageUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  hasContent: boolean;
  read: boolean;
}

export interface ItemsPage {
  items: ItemDTO[];
  nextCursor: string | null;
}

export type Selection =
  | { kind: 'all' }
  | { kind: 'category'; id: string }
  | { kind: 'feed'; id: string };

export type DashboardMode = 'guest' | 'user';
