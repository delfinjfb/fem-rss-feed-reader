import bcrypt from 'bcryptjs';
import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db';
import { signInSchema } from '@/lib/auth/validation';

class RateLimited extends CredentialsSignin {
  code = 'rate_limited';
}

// Compared against when the email is unknown, so a miss costs the same time as a wrong password.
// Real bcrypt hash (cost 12) of a throwaway string; it matches no user's password.
const DUMMY_HASH = '$2b$12$yOsBP6Ozayr7hVJbBbODc.yovnkcXAXkIoG3h/HPICASCms8/56FC';

declare module 'next-auth' {
  interface Session {
    user: { id: string; email: string; name?: string | null };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/sign-in' },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = signInSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Imported lazily: rate-limit reads request headers, only valid inside a request.
        const { allowAttempt } = await import('@/lib/auth/rate-limit');
        if (!(await allowAttempt('sign-in', email))) throw new RateLimited();

        const user = await prisma.user.findUnique({ where: { email } });
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok) return null;
        return { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
        return token;
      }
      // Every later check: a password reset bumps sessionVersion and invalidates older tokens.
      if (!token.sub) return null;
      const current = await prisma.user.findUnique({ where: { id: token.sub }, select: { sessionVersion: true } });
      if (!current || current.sessionVersion !== token.sv) return null;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
