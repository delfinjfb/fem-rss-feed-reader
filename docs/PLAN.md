# Frontpage build plan

Stack: Next.js 16 (App Router) + TypeScript, Postgres (Neon in prod, Docker locally) via Prisma 7,
Auth.js v5 (credentials), Tailwind v4 with the starter tokens, TanStack Query, Vitest, Playwright.
Deploy: Vercel.

## Milestones

1. **Foundation** — done 2026-11-15
   - Prisma schema (shared feeds/items, per-user subscriptions, watermark read state, bookmarks)
   - Feed parser: RSS 2.0, Atom, RDF, encodings, entities, dates, malformed XML (Vitest)
   - OPML import/export with the sample file's edge cases (Vitest)
   - Server fetcher: 10 s timeout, SSRF guard, ETag/Last-Modified, manual redirects, backoff
2. **Tracer bullet (guest)** — landing → "Try as guest" → dashboard with the 19 sample feeds, list layout
3. **Auth** — sign up / in / out, password reset, protected routes
4. **Feed management** — add (validate), edit, remove, categories (CRUD, reorder), health dashboard
5. **Reading** — read/unread + watermark mark-all-read, reader view, next/previous, bookmarks, search
6. **Design challenges** — onboarding/discovery (starter packs + OPML), digest ("since last visit"), layouts (list / compact / cards / split)
7. **Stretch** — refresh & polling, keyboard shortcuts + command palette, OPML UI
8. **Ship** — a11y + performance pass, README, deploy, submit

## Open action items

- **Neon database for production** — raised 2026-11-15. Needs: Delfin to create a Neon project
  (or the Vercel Marketplace Neon integration) and give the pooled `DATABASE_URL` to Vercel.
- **Email provider for password reset** — raised 2026-11-15. Needs: a decision (Resend free tier
  is the default proposal) and an API key in Vercel env. Until then reset links are logged server-side in dev only.
- **Dead sample feeds** — raised 2026-11-15. Figma Blog and Netlify Blog answer 404 today; they are
  kept to exercise the error state. Decide later whether the guest seed should swap in their current URLs.
- **DNS rebinding** — raised 2026-11-15. The SSRF guard resolves the host before fetching, but the
  socket resolves again. Acceptable for this project; a pinned-IP undici dispatcher would close it.
