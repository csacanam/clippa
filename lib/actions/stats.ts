"use server";

import { createServerClient } from "@/lib/supabase/server";

export type PublicStats = {
  creatorsCount: number;
  clipsCount: number;
  payoutsCount: number;
};

/**
 * Platform-wide counts for the public landing page. No auth — only returns
 * aggregate counts, no row data.
 */
export async function getPublicStats(): Promise<PublicStats> {
  const sb = createServerClient();
  const [creators, clips, payouts] = await Promise.all([
    sb.from("creators").select("id", { count: "exact", head: true }),
    sb.from("clips").select("id", { count: "exact", head: true }),
    sb.from("payouts").select("id", { count: "exact", head: true }),
  ]);
  return {
    creatorsCount: creators.count ?? 0,
    clipsCount: clips.count ?? 0,
    payoutsCount: payouts.count ?? 0,
  };
}
