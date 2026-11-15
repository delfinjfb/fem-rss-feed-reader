import 'server-only';

interface Mail {
  to: string;
  subject: string;
  text: string;
}

const RESEND_TIMEOUT_MS = 10_000;

/**
 * Send a transactional email through Resend when RESEND_API_KEY and MAIL_FROM are set.
 * Without them: in development the message is printed to the server console (so the reset flow
 * is testable); in production nothing is logged, because a reset link is a credential.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[mail:dev] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    } else {
      console.warn('[mail] RESEND_API_KEY / MAIL_FROM not set: email not sent.');
    }
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: mail.to, subject: mail.subject, text: mail.text }),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });
  if (!res.ok) console.error(`[mail] Resend answered HTTP ${res.status}`);
}
