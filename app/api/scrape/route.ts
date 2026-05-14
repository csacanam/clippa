import { NextResponse } from "next/server";

import type { Platform } from "@/lib/campaigns";
import { scrapePost } from "@/lib/scrapers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { platform: Platform; postUrl: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.platform || !body.postUrl) {
    return NextResponse.json(
      { ok: false, error: "platform and postUrl are required" },
      { status: 400 }
    );
  }

  const result = await scrapePost(body.platform, body.postUrl);
  return NextResponse.json(result, {
    status: result.ok ? 200 : 502,
  });
}
