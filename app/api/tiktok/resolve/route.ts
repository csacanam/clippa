/**
 * Edge-runtime endpoint that resolves a TikTok short link to its canonical
 * form. Lives in the Edge runtime (V8 isolates) on purpose — Vercel's Edge
 * IPs aren't on TikTok's datacenter blocklist the way the regular Node
 * functions on AWS Lambda are.
 *
 * Internal-only: called from `lib/scrapers/tiktok.ts`. Returns the resolved
 * URL string or null.
 */

export const runtime = "edge";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url).searchParams.get("url");
  if (!url || !/^https?:\/\/(vt|vm)\.tiktok\.com\//i.test(url)) {
    return Response.json({ ok: false, error: "bad url" }, { status: 400 });
  }
  // Try GET with manual redirect handling so a 301 still gives us the
  // Location header even if the downstream destination would 429. HEAD
  // sometimes gets rate-limited as a unit by TikTok.
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });
    // 301/302/307/308 → Location is the canonical URL.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) {
        return Response.json({ ok: true, status: res.status, resolved: location });
      }
    }
    // No redirect (e.g. 429, or 200 from short host directly) — return what
    // we got so the caller can decide.
    return Response.json({ ok: true, status: res.status, resolved: res.url });
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 502 }
    );
  }
}
