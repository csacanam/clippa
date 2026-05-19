/**
 * Standalone end-to-end test for the TikTok scraper, mirroring
 * `lib/scrapers/tiktok.ts`:
 *   1. Resolve a vt.tiktok.com / vm.tiktok.com short link via TikTok's
 *      own oembed endpoint.
 *   2. Try the cheap `postURLs` path on Apify's clockworks/tiktok-scraper.
 *   3. If the post comes back as "Post not found or private", retry via
 *      `profiles: [<author>]` and filter for the video id.
 *   4. Print whatever survives.
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
function tiktokAuthor(url) {
  const m = url.match(/tiktok\.com\/@([^/?#]+)/i);
  return m ? m[1] : null;
}

async function resolveTiktokShortLink(url) {
  if (tiktokVideoId(url)) return url;
  if (!/^https?:\/\/(vt|vm)\.tiktok\.com\//i.test(url)) return url;
  const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (!res.ok) return url;
  const data = await res.json();
  if (data.author_unique_id && data.embed_product_id) {
    return `https://www.tiktok.com/@${data.author_unique_id}/video/${data.embed_product_id}`;
  }
  return url;
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

function summarize(item) {
  return {
    id: item.id,
    author: item.authorMeta?.name,
    views: item.playCount,
    canonical: item.webVideoUrl,
    caption: (item.text ?? "").slice(0, 80) + (((item.text ?? "").length > 80) ? "…" : ""),
  };
}

(async () => {
  console.log(`\n[1] Input URL:    ${URL_ARG}`);

  console.log(`\n[2] Resolving short link via oembed…`);
  const canonical = await resolveTiktokShortLink(URL_ARG);
  console.log(`    → canonical:  ${canonical}`);
  if (!tiktokVideoId(canonical)) {
    console.error("\n❌ Resolution failed.");
    process.exit(1);
  }

  console.log(`\n[3] Cheap path: postURLs…`);
  const primary = await runScraper({ postURLs: [canonical], resultsPerPage: 1 });
  const first = primary[0];
  if (first && !first.error) {
    console.log(`    ✅ ${JSON.stringify(summarize(first), null, 2)}`);
    return;
  }
  console.log(`    ❌ ${first?.error ?? "no items"}`);

  const author = tiktokAuthor(canonical);
  const videoId = tiktokVideoId(canonical);
  if (!author) {
    console.error("\n❌ No author parsed for fallback.");
    process.exit(1);
  }
  console.log(`\n[4] Fallback: profiles=[${author}], looking for id=${videoId}…`);
  const profile = await runScraper({ profiles: [author], resultsPerPage: 5 });
  const found = profile.find((it) => it.id === videoId);
  if (!found) {
    console.error(`\n❌ Video not found in profile's last 5 posts.`);
    process.exit(1);
  }
  console.log(`    ✅ ${JSON.stringify(summarize(found), null, 2)}`);
})();
