import "server-only";

import { verifyAccessToken } from "@privy-io/node";
import { createRemoteJWKSet } from "jose";

import { createServerClient } from "@/lib/supabase/server";

const APP_ID = process.env.PRIVY_APP_ID!;
const APP_SECRET = process.env.PRIVY_APP_SECRET!;

// Privy issues access tokens signed with a key published at this JWKS URL.
// We cache the JWKSet across requests so we don't refetch on every call.
const jwks = createRemoteJWKSet(
  new URL(`https://auth.privy.io/api/v1/apps/${APP_ID}/jwks.json`)
);

/**
 * Fetches the full Privy user record by user_id using REST API + Basic auth.
 * (The Node SDK's users().get() requires an identity_token, which we don't
 * have when only the access token reaches the server.)
 */
async function fetchPrivyUser(userId: string): Promise<{
  id: string;
  linked_accounts: Array<{ type?: string; address?: string }>;
}> {
  const auth = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64");
  const res = await fetch(`https://api.privy.io/v1/users/${userId}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      "privy-app-id": APP_ID,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Privy users API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export type UserRole = "creator" | "brand";

export type User = {
  id: string;
  privy_user_id: string;
  email: string;
  country: string | null;
  wallet_address: string;
  primary_role: UserRole;
  created_at: string;
};

/**
 * Back-compat alias. Most call sites still use `creator` as a variable name
 * for historical reasons (the user acting as creator in the clip / payout
 * context). Type is identical to `User`.
 */
export type Creator = User;

export type AuthContext = {
  privyUserId: string;
  email: string;
  walletAddress: string;
};

/**
 * Verifies a Privy access token, then fetches the user's profile from
 * Privy to extract email + wallet address.
 */
export async function verifyToken(accessToken: string): Promise<AuthContext> {
  if (!accessToken) throw new Error("Missing access token");

  const claims = await verifyAccessToken({
    access_token: accessToken,
    app_id: APP_ID,
    verification_key: jwks,
  });

  const user = await fetchPrivyUser(claims.user_id);

  const linked = user.linked_accounts ?? [];
  const emailAccount = linked.find((a) => a.type === "email");
  const walletAccount = linked.find((a) => a.type === "wallet");

  const email = emailAccount?.address;
  const wallet = walletAccount?.address;

  if (!email) throw new Error("User has no email linked");
  if (!wallet) throw new Error("User has no wallet linked");

  return {
    privyUserId: claims.user_id,
    email: email.toLowerCase(),
    walletAddress: wallet.toLowerCase(),
  };
}

/**
 * Verifies the token, then upserts the user row.
 * Returns the row from DB.
 *
 * `defaultRole` only applies on first-time creation — subsequent calls return
 * the user's existing role unchanged. Use `setPrimaryRole` to switch later.
 */
export async function requireUser(
  accessToken: string,
  defaultRole: UserRole = "creator"
): Promise<User> {
  const auth = await verifyToken(accessToken);
  const sb = createServerClient();

  // Try to find existing user by privy_user_id.
  const found = await sb
    .from("users")
    .select("*")
    .eq("privy_user_id", auth.privyUserId)
    .maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return found.data as User;

  // First time we see this user — create the row.
  const inserted = await sb
    .from("users")
    .insert({
      privy_user_id: auth.privyUserId,
      email: auth.email,
      wallet_address: auth.walletAddress,
      primary_role: defaultRole,
    })
    .select("*")
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data as User;
}

/** @deprecated Prefer `requireUser`. Kept for back-compat with creator-flow call sites. */
export const requireCreator = requireUser;

const ADMINS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

/** True if the email is in the operator allowlist. Useful for actions
 *  that allow either an admin or a specific owner (e.g. brand moderating
 *  clips on their own campaign). */
export function isAdminEmail(email: string): boolean {
  return ADMINS.has(email.toLowerCase());
}

export async function requireAdmin(accessToken: string): Promise<User> {
  const user = await requireUser(accessToken);
  if (!ADMINS.has(user.email)) {
    throw new Error("Forbidden");
  }
  return user;
}

/**
 * Updates the user's primary role. Used by the header role-switcher and by
 * the brand-onboarding redirect (first login from /brands lands them as brand).
 */
export async function setPrimaryRole(
  accessToken: string,
  role: UserRole
): Promise<User> {
  const user = await requireUser(accessToken);
  if (user.primary_role === role) return user;

  const sb = createServerClient();
  const { data, error } = await sb
    .from("users")
    .update({ primary_role: role })
    .eq("id", user.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as User;
}
