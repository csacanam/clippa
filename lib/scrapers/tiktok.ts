/**
 * TikTok view scraper via Apify.
 *
 * Uses `clockworks/tiktok-scraper` (~$0.40 / 1,000 results). Apify handles
 * the proxy rotation, HTML changes, and soft rate-limits that broke our
 * previous direct-fetch approach.
 *
 * Two-pass strategy:
 *   1. Cheap path — call the actor with `postURLs`. One result per input,
 *      ~$0.0004 per call.
 *   2. Fallback — for posts the actor returns "Post not found or private"
 *      on (a real, known-broken edge case on the postURLs code path), we
 *      retry via `profiles: [<author>]` and filter the returned posts to
 *      the specific video id. Costs more (50-ish results per profile) but
 *      only fires for the problem posts.
 *
 * Set APIFY_API_TOKEN in .env to enable.
 */

import type { ScrapeResult } from "./types";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

const APIFY_ENDPOINT = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items`;
// Postpages-broken posts are almost always recent uploads, so the target
// video lives at the top of the creator's profile. 5 covers the typical
// case at 10× lower cost than a deeper scan.
const PROFILE_FALLBACK_RESULTS = 5;

type ApifyItem = {
  id?: string;
  text?: string; // caption
  playCount?: number;
  authorMeta?: {
    name?: string; // username
  };
  webVideoUrl?: string;
  error?: string;
};

/** Extracts the numeric video id from a TikTok URL, used to match results. */
function tiktokVideoId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

/** Extracts the @username from a canonical TikTok URL. */
function tiktokAuthor(url: string): string | null {
  const m = url.match(/tiktok\.com\/@([^/?#]+)/i);
  return m ? m[1] : null;
}

/**
 * Short links (vt.tiktok.com/XXX, vm.tiktok.com/XXX) have to be resolved to
 * the canonical `www.tiktok.com/@user/video/<id>` form before Apify can
 * scrape them — the actor itself doesn't follow the redirect, and Vercel's
 * datacenter IPs get 403'd if we try the redirect ourselves.
 *
 * TikTok's own oembed endpoint accepts any TikTok URL (short or canonical),
 * returns metadata, and is unauthenticated / server-friendly because it's
 * meant for embed previews on platforms like Twitter and Slack. We pull
 * `author_unique_id` + `embed_product_id` from the response and rebuild the
 * canonical URL ourselves.
 *
 * Already-canonical URLs are a no-op.
 */
type TiktokOembed = {
  canonical: string; // www.tiktok.com/@user/video/<id>
  author: string;   // @username, no @
  videoId: string;
  caption: string;  // the title field includes hashtags
};

/**
 * Calls TikTok's oembed endpoint and returns the post's canonical URL,
 * author, video id, and caption. This is the only public TikTok endpoint
 * that works server-friendly (it's meant for embed previews on Twitter /
 * Slack / etc.).
 *
 * Used for:
 *  1. Resolving vt.tiktok.com short links to the canonical form before
 *     handing them to Apify.
 *  2. Synthetic fallback data when Apify's scraper can't find the post —
 *     enough to validate caption + author and accept the clip with 0
 *     initial views. The hourly worker fills in views later.
 *
 * Returns null when oembed itself fails (typically 400/429 from datacenter
 * IPs or genuinely-deleted posts).
 */
async function oembedAttempt(url: string): Promise<TiktokOembed | null | "retry"> {
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      {
        headers: {
          // Browser-like UA — TikTok rate-limits / 400s anonymous Node fetch
          // from datacenter IPs.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) {
      console.error(`[tiktok] oembed http=${res.status} url=${url}`);
      // 400 / 429 are typically transient rate limits — worth one retry.
      return res.status === 400 || res.status === 429 ? "retry" : null;
    }
    const data = (await res.json()) as {
      author_unique_id?: string;
      embed_product_id?: string;
      title?: string;
    };
    if (!data.author_unique_id || !data.embed_product_id) {
      console.error(
        `[tiktok] oembed missing fields url=${url} payload=${JSON.stringify(data).slice(0, 200)}`
      );
      return null;
    }
    return {
      canonical: `https://www.tiktok.com/@${data.author_unique_id}/video/${data.embed_product_id}`,
      author: data.author_unique_id,
      videoId: data.embed_product_id,
      caption: data.title ?? "",
    };
  } catch (e) {
    console.error(`[tiktok] oembed error url=${url} ${(e as Error).message}`);
    return "retry";
  }
}

async function fetchTiktokOembed(url: string): Promise<TiktokOembed | null> {
  if (!/^https?:\/\/((vt|vm)\.tiktok\.com|(www\.)?tiktok\.com\/@)/i.test(url)) {
    return null;
  }
  // Normalize trailing slash — TikTok's oembed has been observed returning
  // 400 on `vt.tiktok.com/<code>/` from some IPs.
  const normalized = url.replace(/\/+$/, "");

  let result = await oembedAttempt(normalized);
  if (result === "retry") {
    console.log(`[tiktok] oembed retry url=${normalized}`);
    await new Promise((r) => setTimeout(r, 1200));
    result = await oembedAttempt(normalized);
  }
  if (result && result !== "retry") {
    console.log(`[tiktok] oembed ok ${normalized} → ${result.canonical}`);
    return result;
  }
  return null;
}

type ApifyRunError = { ok: false; error: string; structural: boolean };

/** Calls the actor and returns its items, or a fatal error. */
async function runApifyScraper(
  input: Record<string, unknown>
): Promise<{ ok: true; items: ApifyItem[] } | ApifyRunError> {
  const endpoint = `${APIFY_ENDPOINT}?token=${encodeURIComponent(APIFY_TOKEN!)}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false,
        ...input,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: `Apify ${res.status}: ${body.slice(0, 200)}`,
        structural:
          res.status === 401 || res.status === 402 || res.status === 403,
      };
    }
    return { ok: true, items: (await res.json()) as ApifyItem[] };
  } catch (e) {
    return {
      ok: false,
      error: `Apify network error: ${(e as Error).message}`,
      structural: false,
    };
  }
}

/**
 * Match items returned by the postURLs path back to their input URLs. First
 * by video id (the reliable case), then positional fallback for inputs we
 * couldn't extract an id from — Apify returns results in input order.
 */
function matchByPostURLs(
  urls: string[],
  items: ApifyItem[]
): (ApifyItem | undefined)[] {
  const matched: (ApifyItem | undefined)[] = new Array(urls.length);
  const claimed = new Set<number>();
  for (let i = 0; i < urls.length; i++) {
    const id = tiktokVideoId(urls[i]);
    if (!id) continue;
    for (let j = 0; j < items.length; j++) {
      if (claimed.has(j)) continue;
      const it = items[j];
      const itemId = it.id ?? (it.webVideoUrl ? tiktokVideoId(it.webVideoUrl) : null);
      if (itemId === id) {
        matched[i] = it;
        claimed.add(j);
        break;
      }
    }
  }
  let cursor = 0;
  for (let i = 0; i < urls.length; i++) {
    if (matched[i]) continue;
    while (cursor < items.length && claimed.has(cursor)) cursor++;
    if (cursor < items.length) {
      matched[i] = items[cursor];
      claimed.add(cursor);
      cursor++;
    }
  }
  return matched;
}

/** True if the item failed in a way the profile fallback can recover from. */
function isRecoverableFailure(item: ApifyItem | undefined): boolean {
  if (!item) return true;
  if (!item.error) return false;
  return /post not found|private/i.test(item.error);
}

/**
 * Scrapes many TikTok posts in a single Apify run. Returns a map keyed by the
 * input URL — every input URL gets an entry (a ScrapeError if it had no match).
 */
export async function scrapeTiktokBatch(
  urls: string[]
): Promise<Map<string, ScrapeResult>> {
  const out = new Map<string, ScrapeResult>();
  if (urls.length === 0) return out;

  if (!APIFY_TOKEN) {
    const err: ScrapeResult = {
      ok: false,
      error: "TikTok scraping isn't configured. Set APIFY_API_TOKEN to enable.",
      structural: false,
    };
    for (const u of urls) out.set(u, err);
    return out;
  }

  // 1. Pull oembed metadata for every URL. Used for:
  //    - resolving short links to canonical (so Apify can find them)
  //    - synthetic fallback if Apify ends up returning nothing usable
  const oembeds = await Promise.all(urls.map((u) => fetchTiktokOembed(u)));
  const resolved = urls.map((u, i) => oembeds[i]?.canonical ?? u);

  // 2. Cheap path: scrape by postURLs.
  console.log(`[tiktok] postURLs scrape n=${resolved.length}`);
  const primary = await runApifyScraper({
    postURLs: resolved,
    resultsPerPage: 1,
  });
  if (!primary.ok) {
    console.error(`[tiktok] postURLs FATAL ${primary.error}`);
    const err: ScrapeResult = {
      ok: false,
      error: primary.error,
      structural: primary.structural,
    };
    for (const u of urls) out.set(u, err);
    return out;
  }
  const matched = matchByPostURLs(resolved, primary.items);
  const primaryHits = matched.filter((m) => m && !m.error).length;
  console.log(
    `[tiktok] postURLs done hits=${primaryHits}/${resolved.length} items=${primary.items.length}`
  );

  // 3. Fallback: for inputs the postURLs path couldn't recover, scrape the
  //    author's profile and filter by video id. Group inputs by author so
  //    one profile scrape can cover multiple stuck inputs from the same
  //    creator.
  const byAuthor = new Map<string, number[]>();
  for (let i = 0; i < urls.length; i++) {
    if (!isRecoverableFailure(matched[i])) continue;
    const author = tiktokAuthor(resolved[i]);
    if (!author) continue;
    if (!byAuthor.has(author)) byAuthor.set(author, []);
    byAuthor.get(author)!.push(i);
  }
  for (const [author, indices] of byAuthor) {
    console.log(
      `[tiktok] profile fallback @${author} stuckInputs=${indices.length} resultsPerPage=${PROFILE_FALLBACK_RESULTS}`
    );
    const profile = await runApifyScraper({
      profiles: [author],
      resultsPerPage: PROFILE_FALLBACK_RESULTS,
    });
    if (!profile.ok) {
      console.error(`[tiktok] profile @${author} FATAL ${profile.error}`);
      continue; // best-effort — leave the primary error in place
    }
    for (const i of indices) {
      const id = tiktokVideoId(resolved[i]);
      if (!id) continue;
      const found = profile.items.find((it) => it.id === id);
      if (found) {
        console.log(`[tiktok] profile @${author} recovered id=${id}`);
        matched[i] = found;
      } else {
        console.error(
          `[tiktok] profile @${author} id=${id} not in last ${PROFILE_FALLBACK_RESULTS} posts (returned ${profile.items.length})`
        );
      }
    }
  }

  // 4. Build output. If Apify gave us a real hit, use it. Otherwise fall
  //    back to oembed data with 0 views — the hourly worker will refresh
  //    views later. We only hard-fail when oembed also said nothing.
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    const item = matched[i];
    const oe = oembeds[i];
    const apifyOk = item && !item.error;
    if (apifyOk) {
      out.set(u, {
        ok: true,
        views: typeof item.playCount === "number" ? item.playCount : 0,
        caption: (item.text ?? "").trim(),
        authorHandle: item.authorMeta?.name?.replace(/^@/, ""),
        canonicalUrl: item.webVideoUrl ?? undefined,
      });
      continue;
    }
    if (oe) {
      console.log(
        `[tiktok] oembed fallback url=${u} apifyError=${item?.error ?? "no item"}`
      );
      out.set(u, {
        ok: true,
        views: 0,
        caption: oe.caption.trim(),
        authorHandle: oe.author,
        canonicalUrl: oe.canonical,
      });
      continue;
    }
    // No item, no oembed. If the input was a short link, the user can
    // paste the canonical URL or retry; signal that with a distinct phrase
    // the validate route can pattern-match for a friendlier message.
    const isShortLink = /^https?:\/\/(vt|vm)\.tiktok\.com\//i.test(u);
    if (isShortLink) {
      out.set(u, {
        ok: false,
        error:
          "Short link unresolved — TikTok rate limit. Paste the full link or retry in a minute.",
        structural: true,
      });
      continue;
    }
    if (item?.error) {
      out.set(u, {
        ok: false,
        error: `Apify scraper: ${item.error}`,
        structural: true,
      });
    } else {
      out.set(u, {
        ok: false,
        error: "Apify returned no results for that TikTok URL.",
        structural: true,
      });
    }
  }
  return out;
}

export async function scrapeTiktok(url: string): Promise<ScrapeResult> {
  const map = await scrapeTiktokBatch([url]);
  return (
    map.get(url) ?? {
      ok: false,
      error: "Apify returned no results for that TikTok URL.",
      structural: true,
    }
  );
}
