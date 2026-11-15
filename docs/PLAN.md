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
2. **Tracer bullet (guest)** — done 2026-11-15: landing → "Try as guest" → dashboard with the 19 sample feeds,
   list layout, session read state, cron warm-up (cold start capped at 4 s; warm load 0.14 s locally)
3. **Auth** — done 2026-11-15: sign up / in / out, password reset (single-use hashed token, revokes
   other sessions), Postgres rate limiting, proxy + page session checks, user dashboard with DB read
   state and a one-click starter pack. 15/15 Playwright checks pass locally.
4. **Feed management** — add (validate), edit, remove, categories (CRUD, reorder), health dashboard
5. **Reading** — read/unread + watermark mark-all-read, reader view, next/previous, bookmarks, search
6. **Design challenges** — onboarding/discovery (starter packs + OPML), digest ("since last visit"), layouts (list / compact / cards / split)
7. **Stretch** — refresh & polling, keyboard shortcuts + command palette, OPML UI
8. **Ship** — a11y + performance pass, README, deploy, submit

## Open action items

- **Neon database for production** — raised 2026-11-15, resolved 2026-11-15: project `shy-morning-82046682`
  (aws-eu-central-1, Postgres 18), migrations applied, TLS 1.3 with `sslmode=verify-full`. Local `.env` points at it.
- **Vercel env vars** — raised 2026-11-15, resolved 2026-11-15: set in project `fem-rss-feed-reader`
  (production, secrets as sensitive). Live at https://fem-rss-feed-reader.vercel.app, deploys on push to `main`.
- **Neon skill silent feedback** — raised 2026-11-15. `.claude/skills/neon/SKILL.md:513-519` tells agents
  to send feedback to Neon without asking. Needs: Delfin's choice (deny rule recommended, or delete the skill).
- **Email provider for password reset** — raised 2026-11-15. Needs: a decision (Resend free tier
  is the default proposal) and an API key in Vercel env. Until then reset links are logged server-side in dev only.
- **Dead sample feeds** — raised 2026-11-15. Figma Blog and Netlify Blog answer 404 today; they are
  kept to exercise the error state. Decide later whether the guest seed should swap in their current URLs.
- **DNS rebinding** — raised 2026-11-15. The SSRF guard resolves the host before fetching, but the
  socket resolves again. Acceptable for this project; a pinned-IP undici dispatcher would close it.
- **Cron frequency** — raised 2026-11-15. Vercel Hobby allows daily cron only, so `/api/cron/refresh`
  runs at 06:00 UTC; page visits refresh due feeds in the background between runs. A Pro plan (or an
  external scheduler calling the endpoint with `CRON_SECRET`) would restore the 15-minute warm-up.
