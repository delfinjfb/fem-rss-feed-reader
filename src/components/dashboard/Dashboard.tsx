'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { signOutAction } from '@/app/(auth)/actions';
import { setItemReadAction } from '@/app/app/actions';
import type { DashboardMode, ItemsPage, NavCategory, Selection } from '@/lib/types';
import { ItemList } from './ItemList';
import { Sidebar } from './Sidebar';
import { useReadState } from './useReadState';

interface Props {
  mode: DashboardMode;
  categories: NavCategory[];
  initialPage: ItemsPage;
  user?: { email: string; name: string | null };
}

export function Dashboard(props: Props) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }));
  return (
    <QueryClientProvider client={client}>
      <DashboardInner {...props} />
    </QueryClientProvider>
  );
}

function DashboardInner({ mode, categories, initialPage, user }: Props) {
  const [selection, setSelection] = useState<Selection>({ kind: 'all' });
  const { isRead, setRead, unreadDelta } = useReadState(mode, mode === 'user' ? setItemReadAction : undefined);
  const drawer = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);

  const feedsById = useMemo(() => new Map(categories.flatMap((c) => c.feeds.map((f) => [f.id, f]))), [categories]);
  const unread = (ids: string[]) =>
    ids.reduce((sum, id) => sum + Math.max(0, (feedsById.get(id)?.unreadCount ?? 0) + (unreadDelta[id] ?? 0)), 0);

  const heading =
    selection.kind === 'all'
      ? 'All articles'
      : selection.kind === 'category'
        ? categories.find((c) => c.id === selection.id)?.name
        : feedsById.get(selection.id)?.title;

  const select = (s: Selection) => {
    setSelection(s);
    drawer.current?.close();
    main.current?.focus();
    window.scrollTo({ top: 0 });
  };

  const sidebar = <Sidebar categories={categories} selection={selection} onSelect={select} unread={unread} />;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--spacing-sidebar)_1fr]">
      <a href="#articles" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-surface focus:p-2">
        Skip to articles
      </a>

      <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-border bg-bg-secondary lg:flex lg:flex-col">
        <Brand />
        {sidebar}
        {user && <Account user={user} />}
      </aside>

      <dialog
        ref={drawer}
        aria-label="Feeds"
        className="m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none bg-bg-secondary text-text-primary backdrop:bg-black/40 lg:hidden"
      >
        <div className="flex items-center justify-between pr-2">
          <Brand />
          <button
            type="button"
            onClick={() => drawer.current?.close()}
            className="grid size-11 place-items-center rounded-md text-text-secondary hover:bg-bg-tertiary"
          >
            <X size={20} aria-hidden="true" />
            <span className="sr-only">Close feeds menu</span>
          </button>
        </div>
        {sidebar}
        {user && <Account user={user} />}
      </dialog>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-bg-primary/90 px-2 py-2 backdrop-blur sm:px-4">
          <button
            type="button"
            onClick={() => drawer.current?.showModal()}
            className="grid size-11 place-items-center rounded-md text-text-secondary hover:bg-bg-tertiary lg:hidden"
          >
            <Menu size={20} aria-hidden="true" />
            <span className="sr-only">Open feeds menu</span>
          </button>
          <h1 className="truncate text-lg font-semibold">{heading}</h1>
        </header>

        {mode === 'guest' && <GuestBanner />}

        <main id="articles" ref={main} tabIndex={-1} className="mx-auto max-w-[var(--container-feed)] focus:outline-none">
          <ItemList
            key={JSON.stringify(selection)}
            mode={mode}
            selection={selection}
            initialPage={selection.kind === 'all' ? initialPage : null}
            feedsById={feedsById}
            isRead={isRead}
            onToggleRead={setRead}
          />
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-5 py-4 text-base font-bold tracking-tight">
      <span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-accent text-xs text-white">F</span>
      Frontpage
    </Link>
  );
}

function Account({ user }: { user: { email: string; name: string | null } }) {
  return (
    <div className="mt-auto flex items-center gap-2 border-t border-border-subtle p-3">
      <p className="min-w-0 flex-1 truncate text-sm text-text-secondary" title={user.email}>
        {user.name ?? user.email}
      </p>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        >
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
}

function GuestBanner() {
  return (
    <div className="border-b border-border-subtle bg-accent-subtle px-4 py-2 text-sm text-text-secondary sm:px-6">
      You’re exploring as a guest. Your reading progress lasts for this browser session.{' '}
      <Link href="/sign-up" className="font-medium text-accent underline-offset-2 hover:underline">
        Create a free account
      </Link>{' '}
      to add your own feeds and keep everything in sync.
    </div>
  );
}
