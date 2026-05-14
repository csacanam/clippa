/**
 * Admin authorization helpers.
 *
 * MVP: a CSV of admin emails in NEXT_PUBLIC_ADMIN_EMAILS.
 * TODO Phase 5.5: server action with ADMIN_EMAILS (no NEXT_PUBLIC_) + Supabase RLS.
 */

function parseAdminEmails(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return parseAdminEmails().includes(email.toLowerCase());
}
