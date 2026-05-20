"use server";

import { requireCreator } from "@/lib/auth-server";
import { getCampaignIdBySlug } from "@/lib/actions/campaigns";
import { createServerClient } from "@/lib/supabase/server";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 30 unambiguous chars
// 6 chars → 30^6 ≈ 729M codes per campaign. With the retry loop below, a
// single campaign comfortably handles millions of creators with no
// practical collision risk. Existing 4-char codes are untouched —
// getOrCreateTrackingCode returns a creator's existing code as-is.
const CODE_LENGTH = 6;

function generateCode(): string {
  const buf = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(buf);
  let out = "";
  for (const b of buf) out += ALPHABET[b % ALPHABET.length];
  return `CLIPPA-${out}`;
}

/**
 * Returns the creator's code for this campaign. Creates one on first call.
 * Idempotent — same creator + same campaign always returns the same code.
 */
export async function getOrCreateTrackingCode(
  identityToken: string,
  campaignSlug: string
): Promise<string> {
  const creator = await requireCreator(identityToken);
  const campaignId = await getCampaignIdBySlug(campaignSlug);
  const sb = createServerClient();

  // Existing?
  const existing = await sb
    .from("creator_campaign_codes")
    .select("code")
    .eq("creator_id", creator.id)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return (existing.data as { code: string }).code;

  // Generate with collision retry — pgerror on UNIQUE(campaign_id, code) means retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const insert = await sb
      .from("creator_campaign_codes")
      .insert({
        creator_id: creator.id,
        campaign_id: campaignId,
        code,
      })
      .select("code")
      .single();
    if (!insert.error) return code;
    // 23505 = unique_violation in postgres
    const e = insert.error as { code?: string };
    if (e.code !== "23505") throw insert.error;
  }
  throw new Error("Could not allocate a tracking code, try again.");
}
