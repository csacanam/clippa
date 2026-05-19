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

/**
 * `code` is a stable identifier the frontend uses to render a localized
 * message. `error` is a human-readable English fallback (so anything that
 * doesn't pattern-match still shows *something*).
 */
type ErrCode =
  | "post_not_found"
  | "code_missing"
  | "rate_limited"
  | "network_error"
  | "scraper_unknown"
  | "bad_request";

type Err = { ok: false; code: ErrCode; error: string };

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
    return NextResponse.json(
      { ok: false, code: "bad_request", error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.platform || !body.postUrl || !body.trackingCode) {
    return NextResponse.json(
      {
        ok: false,
        code: "bad_request",
        error: "platform, postUrl and trackingCode are required",
      },
      { status: 400 }
    );
  }

  console.log(
    `[validate] in platform=${body.platform} url=${body.postUrl.slice(0, 80)} code=${body.trackingCode}`
  );

  // Instagram: short-circuit. Apify's IG scraper uses a headless browser
  // and takes 30-120 s; the user was watching "Verifying..." for the whole
  // run only to land on manual review anyway. Skip the scrape entirely —
  // every IG submission goes straight to manual review.
  if (body.platform === "instagram") {
    console.log("[validate] instagram → soft-pass to manual review");
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
    const msg = result.error.toLowerCase();
    let code: ErrCode = "scraper_unknown";
    if (
      msg.includes("post not found") ||
      msg.includes("private") ||
      msg.includes("blob not found") ||
      msg.includes("iteminfo missing") ||
      msg.includes("deleted")
    ) {
      code = "post_not_found";
    } else if (msg.includes("http 403") || msg.includes("http 429")) {
      code = "rate_limited";
    } else if (msg.includes("network error")) {
      code = "network_error";
    }
    console.error(
      `[validate] scrape failed code=${code} url=${body.postUrl} raw=${result.error}`
    );
    return NextResponse.json(
      { ok: false, code, error: result.error },
      { status: 400 }
    );
  }

  if (!captionHasCode(result.caption, body.trackingCode)) {
    console.error(
      `[validate] code missing code=${body.trackingCode} url=${body.postUrl} caption=${result.caption.slice(0, 120)}`
    );
    return NextResponse.json(
      {
        ok: false,
        code: "code_missing",
        error: `We couldn't find your code ${body.trackingCode} in the caption.`,
      },
      { status: 400 }
    );
  }

  console.log(
    `[validate] ok url=${result.canonicalUrl ?? body.postUrl} views=${result.views} author=@${result.authorHandle ?? "?"}`
  );
  return NextResponse.json({
    ok: true,
    views: result.views,
    caption: result.caption,
    authorHandle: result.authorHandle,
    canonicalUrl: result.canonicalUrl,
  });
}
