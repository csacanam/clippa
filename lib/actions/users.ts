"use server";

import {
  requireUser,
  setPrimaryRole as setPrimaryRoleServer,
  type User,
  type UserRole,
} from "@/lib/auth-server";

/**
 * Returns the current user's profile (id, email, wallet, primary_role).
 * Lazy-creates the row on first call with the given default role.
 */
export async function getMyUser(
  identityToken: string,
  defaultRole: UserRole = "creator"
): Promise<User> {
  return requireUser(identityToken, defaultRole);
}

/**
 * Switches the user's primary role. Called from the header role-switcher
 * and from the brand-landing post-login redirect.
 */
export async function setMyPrimaryRole(
  identityToken: string,
  role: UserRole
): Promise<User> {
  return setPrimaryRoleServer(identityToken, role);
}
