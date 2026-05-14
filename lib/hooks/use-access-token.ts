"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

/**
 * Returns the current Privy access token, or null while loading / signed out.
 * Use this to pass to server actions that call requireCreator/requireAdmin.
 */
export function useAccessToken(): string | null {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated) {
      setToken(null);
      return;
    }
    let cancelled = false;
    getAccessToken()
      .then((t) => {
        if (!cancelled) setToken(t);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  return token;
}
