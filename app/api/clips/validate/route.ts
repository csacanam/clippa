import { NextResponse } from "next/server";

import type { Platform } from "@/lib/campaigns";
import { scrapePost } from "@/lib/scrapers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Scrapes the post via Apify before validating — can take 10-60s.
export const maxDuration = 60;

type Body = {
  platform: Platform;
  postUrl: string;
  trackingCode: string;
};

type Ok = {
  ok: true;
  views: number;
  caption: string;
  authorHandle?: string;
  /** Canonical post URL — short links (vt.tiktok.com) resolve to the full
   *  form. The frontend should submit THIS, not the raw pasted URL. */
  canonicalUrl?: string;
  /** When true, scraping couldn't verify the post (e.g. Instagram).
   *  Frontend should still let it through but flag for admin review. */
  needsManualReview?: boolean;
  warning?: string;
};

type Err = { ok: false; error: string };

function captionHasCode(caption: string, code: string): boolean {
  // Case-insensitive substring match. Accepts "#CLIPPA-X8K2", "CLIPPA-X8K2",
  // "clippa-x8k2", inside hashtags, comments, anywhere in the desc.
  return caption.toLowerCase().includes(code.toLowerCase());
}

export async function POST(req: Request): Promise<NextResponse<Ok | Err>> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.platform || !body.postUrl || !body.trackingCode) {
    return NextResponse.json(
      { ok: false, error: "platform, postUrl and trackingCode are required" },
      { status: 400 }
    );
  }

  // Instagram: short-circuit. Apify's IG scraper uses a headless browser
  // and takes 30-120 s; the user was watching "Verifying..." for the whole
  // run only to land on manual review anyway. Skip the scrape entirely —
  // every IG submission goes straight to manual review.
  if (body.platform === "instagram") {
    return NextResponse.json({
      ok: true,
      views: 0,
      caption: "",
      needsManualReview: true,
      warning:
        "We can't verify Instagram posts automatically yet. Your clip will go to manual review.",
    });
  }

  const result = await scrapePost(body.platform, body.postUrl);

  if (!result.ok) {
    // Map scraper errors to user-friendly messages.
    const msg = result.error.toLowerCase();
    let userError = result.error;
    if (
      msg.includes("blob not found") ||
      msg.includes("iteminfo missing") ||
      msg.includes("deleted or private")
    ) {
      userError =
        "We couldn't load that post. It might be private, deleted, or the link is wrong.";
    } else if (msg.includes("http 403") || msg.includes("http 429")) {
      userError =
        "Too many checks right now. Wait a minute and try submitting again.";
    } else if (msg.includes("network error")) {
      userError = "We couldn't reach the post. Check the link and try again.";
    }
    return NextResponse.json({ ok: false, error: userError }, { status: 400 });
  }

  if (!captionHasCode(result.caption, body.trackingCode)) {
    return NextResponse.json(
      {
        ok: false,
        error: `We couldn't find your code ${body.trackingCode} in the caption. Edit your post to include it, then try again.`,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    views: result.views,
    caption: result.caption,
    authorHandle: result.authorHandle,
    canonicalUrl: result.canonicalUrl,
  });
}
