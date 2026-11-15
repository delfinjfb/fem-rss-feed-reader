'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { DashboardMode, ItemDTO } from '@/lib/types';

/**
 * Read state = what the server said (ItemDTO.read, NavFeed.unreadCount) + local overrides.
 * An override remembers the server value it replaced, so unread counts can be adjusted by delta.
 * Guests keep overrides in sessionStorage (spec: guest data lasts one session);
 * signed-in users keep them in memory while the server action persists the change.
 */
interface Override {
  feedId: string;
  read: boolean;
  base: boolean;
}
type Overrides = Record<string, Override>;

const GUEST_KEY = 'frontpage:guest:read:v2';
const EMPTY = '{}';

interface Store {
  get: () => string;
  set: (value: string) => void;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const sessionStore: Store = {
  get: () => {
    try {
      return sessionStorage.getItem(GUEST_KEY) ?? EMPTY;
    } catch {
      return EMPTY;
    }
  },
  set: (value) => {
    try {
      sessionStorage.setItem(GUEST_KEY, value);
    } catch {
      // storage blocked: overrides last until reload
    }
    notify();
  },
};

let memory = EMPTY;
const memoryStore: Store = {
  get: () => memory,
  set: (value) => {
    memory = value;
    notify();
  },
};

const parse = (raw: string): Overrides => {
  try {
    return JSON.parse(raw) as Overrides;
  } catch {
    return {};
  }
};

export function useReadState(mode: DashboardMode, persist?: (itemId: string, read: boolean) => Promise<{ ok: boolean }>) {
  const store = mode === 'guest' ? sessionStore : memoryStore;
  const raw = useSyncExternalStore(subscribe, store.get, () => EMPTY);
  const overrides = useMemo(() => parse(raw), [raw]);

  const write = useCallback(
    (item: Pick<ItemDTO, 'id' | 'feedId' | 'read'>, read: boolean) => {
      const next = parse(store.get());
      const base = next[item.id]?.base ?? item.read;
      if (read === base) delete next[item.id];
      else next[item.id] = { feedId: item.feedId, read, base };
      store.set(JSON.stringify(next));
    },
    [store],
  );

  const setRead = useCallback(
    (item: Pick<ItemDTO, 'id' | 'feedId' | 'read'>, read: boolean) => {
      const before = overrides[item.id]?.read ?? item.read;
      if (before === read) return;
      write(item, read); // optimistic
      persist?.(item.id, read)
        .then((r) => !r.ok && write(item, before))
        .catch(() => write(item, before));
    },
    [overrides, persist, write],
  );

  const isRead = useCallback((item: Pick<ItemDTO, 'id' | 'read'>) => overrides[item.id]?.read ?? item.read, [overrides]);

  /** Change in unread count per feed caused by local overrides. */
  const unreadDelta = useMemo(() => {
    const delta: Record<string, number> = {};
    for (const o of Object.values(overrides)) {
      delta[o.feedId] = (delta[o.feedId] ?? 0) + (o.read ? 0 : 1) - (o.base ? 0 : 1);
    }
    return delta;
  }, [overrides]);

  return { isRead, setRead, unreadDelta };
}
