"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { setMyPrimaryRole } from "@/lib/actions/users";
import { type UserRole } from "@/lib/auth-server";
import { useAccessToken } from "@/lib/hooks/use-access-token";

/**
 * Header-style link that switches the user's primary role and routes them
 * to the matching dashboard. Used in both /app (Brand mode →) and /brand
 * (Creator mode →) headers so a multi-role user lands on the right
 * dashboard next time they log in.
 */
export function RoleSwitchLink({
  targetRole,
  targetHref,
  label,
  className,
}: {
  targetRole: UserRole;
  targetHref: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const identityToken = useAccessToken();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (identityToken) {
        // Best-effort — even if this fails, still navigate. The role is just
        // a default for the post-login destination; both dashboards are
        // always reachable by URL.
        await setMyPrimaryRole(identityToken, targetRole).catch(() => {});
      }
      router.push(targetHref);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={
        className ??
        "hidden font-body text-sm font-medium text-ink-soft underline-offset-4 hover:underline disabled:opacity-50 sm:inline"
      }
    >
      {label}
    </button>
  );
}
