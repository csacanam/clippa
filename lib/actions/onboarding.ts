"use server";

import { requireCreator } from "@/lib/auth-server";
import type { OnboardingData } from "@/lib/onboarding";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Returns the current creator's onboarding data, or null if they haven't
 * completed it yet. `country` is the source of truth for "onboarded".
 */
export async function getMyOnboarding(
  identityToken: string
): Promise<OnboardingData | null> {
  const creator = await requireCreator(identityToken);
  if (!creator.country) return null;
  return { country: creator.country };
}

export async function saveOnboarding(
  identityToken: string,
  input: { country: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const country = input.country?.trim();
  if (!country) return { ok: false, error: "Country is required." };

  const creator = await requireCreator(identityToken);
  const sb = createServerClient();
  const { error } = await sb
    .from("users")
    .update({ country })
    .eq("id", creator.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
