/**
 * Standalone end-to-end test for the TikTok scraper, mirroring
 * `lib/scrapers/tiktok.ts`. Three layers of fallback:
 *
 *   1. oembed gives us canonical URL + caption + author. If it fails, we
 *      can't proceed.
 *   2. Apify postURLs path (cheap, 1 result per input).
 *   3. Apify profiles path (more results, filter by id) for the posts
 *      where postURLs returns "Post not found or private."
 *   4. If both Apify paths fail, fall back to oembed data with views=0.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node scripts/test-tiktok-resolver.mjs <tiktok-url>
 */

const URL_ARG = process.argv[2];
if (!URL_ARG) {
  console.error("Usage: node scripts/test-tiktok-resolver.mjs <tiktok-url>");
  process.exit(1);
}

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) {
  console.error("APIFY_API_TOKEN missing. Did you `source .env`?");
  process.exit(1);
}

const APIFY_ENDPOINT = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_TOKEN)}`;

function tiktokVideoId(url) {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

async function fetchOembed(url) {
  const normalized = url.replace(/\/+$/, "");
  const res = await fetch(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(normalized)}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    }
  );
  console.log(`    oembed status: ${res.status}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.author_unique_id || !data.embed_product_id) return null;
  return {
    canonical: `https://www.tiktok.com/@${data.author_unique_id}/video/${data.embed_product_id}`,
    author: data.author_unique_id,
    videoId: data.embed_product_id,
    caption: data.title ?? "",
  };
}

async function runScraper(input) {
  const res = await fetch(APIFY_ENDPOINT, {
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
  if (!res.ok) throw new Error(`Apify HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

(async () => {
  console.log(`\n[1] Input URL:    ${URL_ARG}`);

  console.log(`\n[2] oembed…`);
  const oe = await fetchOembed(URL_ARG);
  if (!oe) {
    console.error("    ❌ oembed failed");
    process.exit(1);
  }
  console.log(`    → canonical:  ${oe.canonical}`);
  console.log(`    → author:     @${oe.author}`);
  console.log(`    → videoId:    ${oe.videoId}`);
  console.log(`    → caption:    ${oe.caption.slice(0, 80)}…`);

  console.log(`\n[3] Apify postURLs…`);
  const primary = await runScraper({ postURLs: [oe.canonical], resultsPerPage: 1 });
  const first = primary[0];
  if (first && !first.error) {
    console.log(`    ✅ views=${first.playCount} from postURLs`);
    return;
  }
  console.log(`    ❌ ${first?.error ?? "no items"}`);

  console.log(`\n[4] Apify profile @${oe.author}…`);
  const profile = await runScraper({ profiles: [oe.author], resultsPerPage: 5 });
  console.log(`    returned ${profile.length} posts`);
  const found = profile.find((it) => it.id === oe.videoId);
  if (found) {
    console.log(`    ✅ views=${found.playCount} from profile`);
    return;
  }
  console.log(`    ❌ id ${oe.videoId} not in profile's last 5`);

  console.log(`\n[5] oembed fallback (views=0)…`);
  console.log(`    ✅ caption=${oe.caption.slice(0, 50)}… author=@${oe.author}`);
  console.log(`    (worker will refresh views later)`);
})();
