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
async function resolveTiktokShortLink(url: string): Promise<string> {
  if (tiktokVideoId(url)) return url;
  if (!/^https?:\/\/(vt|vm)\.tiktok\.com\//i.test(url)) return url;
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    );
    if (!res.ok) {
      console.error(`[tiktok] oembed http=${res.status} url=${url}`);
      return url;
    }
    const data = (await res.json()) as {
      author_unique_id?: string;
      embed_product_id?: string;
    };
    if (data.author_unique_id && data.embed_product_id) {
      const canonical = `https://www.tiktok.com/@${data.author_unique_id}/video/${data.embed_product_id}`;
      console.log(`[tiktok] oembed resolved ${url} → ${canonical}`);
      return canonical;
    }
    console.error(`[tiktok] oembed missing fields url=${url} payload=${JSON.stringify(data).slice(0, 200)}`);
    return url;
  } catch (e) {
    console.error(`[tiktok] oembed error url=${url} ${(e as Error).message}`);
    return url;
  }
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

  // 1. Resolve short links via TikTok's oembed.
  const resolved = await Promise.all(urls.map(resolveTiktokShortLink));

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

  // 4. Build output.
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    const item = matched[i];
    if (!item) {
      out.set(u, {
        ok: false,
        error: "Apify returned no results for that TikTok URL.",
        structural: true,
      });
      continue;
    }
    if (item.error) {
      out.set(u, {
        ok: false,
        error: `Apify scraper: ${item.error}`,
        structural: true,
      });
      continue;
    }
    out.set(u, {
      ok: true,
      views: typeof item.playCount === "number" ? item.playCount : 0,
      caption: (item.text ?? "").trim(),
      authorHandle: item.authorMeta?.name?.replace(/^@/, ""),
      canonicalUrl: item.webVideoUrl ?? undefined,
    });
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
