import 'server-only';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

const WINDOW_SECONDS = 15 * 60;

export const LIMITS = {
  'sign-in': 10,
  'sign-up': 5,
  'forgot': 5,
  'reset': 10,
  'add-feed': 30,
} as const;

/** Client IP as Vercel forwards it; "unknown" locally. Only used as a rate-limit key. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

/**
 * Count one attempt for `action` + `subject` in a fixed 15-minute window; false once over the limit.
 * One atomic upsert, so concurrent requests can't both read the same count.
 */
export async function allowAttempt(action: keyof typeof LIMITS, subject: string): Promise<boolean> {
  const key = `${action}:${subject}`;
  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${WINDOW_SECONDS})
                     THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${WINDOW_SECONDS})
                     THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  return row.count <= LIMITS[action];
}
