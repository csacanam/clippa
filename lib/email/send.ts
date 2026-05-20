import "server-only";

/**
 * Thin SendGrid wrapper for Clippa's transactional emails (clip approved /
 * rejected, payout sent). Plain fetch — no SDK — to keep the bundle small.
 *
 * Every send is best-effort: callers must never let an email failure roll
 * back the underlying action (approving a clip, sending a payout).
 *
 * Env:
 *   SENDGRID_API_KEY  — required to actually send; absent ⇒ no-op
 *   EMAIL_FROM        — "Clippa <hi@clippa.fun>" style; defaults below
 *   EMAIL_REPLY_TO    — optional; where creator replies land if different
 *                       from the From address
 */

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

function fromHeader(): string {
  return process.env.EMAIL_FROM || "Clippa <hi@clippa.fun>";
}

/** SendGrid wants `from`/`reply_to` as {email, name}, not "Name <email>". */
function parseAddress(raw: string): { email: string; name?: string } {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(.*)<([^>]+)>$/);
  if (!m) return { email: trimmed };
  return { email: m[2].trim(), name: m[1].trim().replace(/^"|"$/g, "") };
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping send");
    return { ok: false, error: "no email provider configured" };
  }

  const replyToRaw = process.env.EMAIL_REPLY_TO;
  const body: Record<string, unknown> = {
    personalizations: [{ to: [{ email: args.to }] }],
    from: parseAddress(fromHeader()),
    subject: args.subject,
    content: [
      { type: "text/plain", value: args.text },
      { type: "text/html", value: args.html },
    ],
  };
  if (replyToRaw) {
    body.reply_to = parseAddress(replyToRaw);
  }

  try {
    const res = await fetch(SENDGRID_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const error = `sendgrid ${res.status}: ${errBody.slice(0, 300)}`;
      console.error(`[email] ${error}`);
      return { ok: false, error };
    }
    console.log(`[email] sent to=${args.to} subject="${args.subject}"`);
    return { ok: true };
  } catch (e) {
    const error = (e as Error).message;
    console.error(`[email] send failed: ${error}`);
    return { ok: false, error };
  }
}
