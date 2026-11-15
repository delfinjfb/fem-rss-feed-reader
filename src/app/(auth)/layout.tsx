import Link from 'next/link';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-bg-secondary px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-bold tracking-tight">
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-accent text-sm text-white">
          F
        </span>
        Frontpage
      </Link>
      <main className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">{children}</main>
    </div>
  );
}
