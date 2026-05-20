import { NextResponse } from "next/server";

import type { Platform } from "@/lib/campaigns";
import { scrapePost } from "@/lib/scrapers";
import { sendAdminAlert } from "@/lib/telegram/send";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Scrapes the post before validating. TikTok (TikWM) is ~2s; Instagram goes
// through Apify's headless-browser scraper which can take 30-120s — hence
// the generous ceiling.
export const maxDuration = 180;

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
};

/**
 * `code` is a stable identifier the frontend uses to render a localized
 * message. `error` is a human-readable English fallback (so anything that
 * doesn't pattern-match still shows *something*).
 */
type ErrCode =
  | "post_not_found"
  | "tracking_unavailable"
  | "short_link_unresolved"
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

  // Both platforms verify the same way: scrape the post, confirm we can read
  // its views, confirm the tracking code is in the caption. If we can't
  // verify it now, the creator finds out at submit — not days later.
  const result = await scrapePost(body.platform, body.postUrl);

  if (!result.ok) {
    const msg = result.error.toLowerCase();
    let code: ErrCode = "scraper_unknown";
    if (msg.includes("short link unresolved")) {
      code = "short_link_unresolved";
    } else if (msg.includes("tracking unavailable")) {
      code = "tracking_unavailable";
    } else if (
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
    // Alert the admin on infrastructure-side failures — a creator did
    // everything right and our scraping couldn't keep up. `code_missing`
    // never reaches here; that's pure creator error and isn't alerted.
    await sendAdminAlert(
      `⚠️ <b>Submit fallido</b> (${body.platform}) — ${code}\n` +
        `${body.postUrl}\n${result.error.slice(0, 200)}`
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
