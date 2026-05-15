"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useTranslation } from "@/components/locale-provider";

/**
 * Wraps authenticated pages. Sends unauthenticated users back to /.
 * Shows a soft loading state while Privy resolves.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="font-display text-sm uppercase tracking-wider text-ink-soft">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (!authenticated) return null;

  return <>{children}</>;
}
