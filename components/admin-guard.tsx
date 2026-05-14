"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { isAdmin } from "@/lib/admin";

/**
 * Gate for admin-only routes. Unauthenticated → /, non-admin → /app.
 *
 * MVP: client-side check using NEXT_PUBLIC_ADMIN_EMAILS. Final version
 * gets a server check + Supabase RLS once Phase 5.5 wires DB.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const email = user?.email?.address;
  const allowed = ready && authenticated && isAdmin(email);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace("/");
      return;
    }
    if (!isAdmin(email)) {
      router.replace("/app");
    }
  }, [ready, authenticated, email, router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="font-display text-sm uppercase tracking-wider text-ink-soft">
          Loading...
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
