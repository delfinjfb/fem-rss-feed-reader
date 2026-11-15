'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

const KEY = 'frontpage:guest:read';
const EMPTY = '{}';

/** itemId -> feedId of every item the guest has read. Session-scoped by design (spec: guest data does not persist). */
type ReadMap = Record<string, string>;

const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return sessionStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeRaw(value: string) {
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // storage blocked (private mode): state lives until the next render only
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function parse(raw: string): ReadMap {
  try {
    return JSON.parse(raw) as ReadMap;
  } catch {
    return {};
  }
}

export function useGuestReadState() {
  // Server snapshot is empty, so SSR and hydration agree; the stored value applies right after.
  const raw = useSyncExternalStore(subscribe, readRaw, () => EMPTY);
  const read = useMemo(() => parse(raw), [raw]);

  const update = useCallback((change: (prev: ReadMap) => ReadMap) => {
    writeRaw(JSON.stringify(change(parse(readRaw()))));
  }, []);

  const setItemRead = useCallback(
    (itemId: string, feedId: string, value: boolean) =>
      update((prev) => {
        const next = { ...prev };
        if (value) next[itemId] = feedId;
        else delete next[itemId];
        return next;
      }),
    [update],
  );

  const readCountByFeed = useMemo(
    () =>
      Object.values(read).reduce<Record<string, number>>((acc, feedId) => {
        acc[feedId] = (acc[feedId] ?? 0) + 1;
        return acc;
      }, {}),
    [read],
  );

  const isRead = useCallback((id: string) => id in read, [read]);

  return { isRead, setItemRead, readCountByFeed };
}
