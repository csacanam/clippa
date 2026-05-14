import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the secret key (bypasses RLS).
 *
 * Only callable from server actions / route handlers. Never import from
 * client components — `import "server-only"` will throw at build time.
 *
 * All Clippa writes happen through this client because we authenticate
 * users via Privy, not Supabase Auth. The server action verifies the
 * Privy token, then writes on behalf of the user.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY"
    );
  }
  return createSupabaseClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
