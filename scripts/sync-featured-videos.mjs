/**
 * Walks the `featured_clips` Storage bucket and sets each clip's
 * `featured_video_url` to the public URL of `<clipId>.mp4` if such a file
 * exists. Idempotent — run it after uploading new featured videos.
 *
 * Naming convention: each file is named exactly `{clip-uuid}.mp4` so we can
 * match the file to the DB row without any manual pasting.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node scripts/sync-featured-videos.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from env.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const BUCKET = "featured_clips";

if (!SUPABASE_URL || !SUPABASE_SECRET) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY");
  process.exit(1);
}

const HEADERS = {
  apikey: SUPABASE_SECRET,
  Authorization: `Bearer ${SUPABASE_SECRET}`,
  "Content-Type": "application/json",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function publicUrlFor(filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
}

// 1. List files in the bucket.
const listRes = await fetch(
  `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
  {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ prefix: "", limit: 1000 }),
  }
);
if (!listRes.ok) {
  console.error(`Storage list failed: ${listRes.status} ${await listRes.text()}`);
  process.exit(1);
}
const files = await listRes.json();
console.log(`Found ${files.length} file(s) in bucket "${BUCKET}".`);

// 2. Build map: clipId → public URL.
const targetByClipId = new Map();
for (const f of files) {
  // Folders / placeholders surface as objects with `id: null`.
  if (!f.id || !f.name) continue;
  const base = f.name.replace(/\.[^.]+$/, "");
  if (!UUID_RE.test(base)) {
    console.log(`- skipping ${f.name} (not a UUID-named file)`);
    continue;
  }
  targetByClipId.set(base, publicUrlFor(f.name));
}
if (targetByClipId.size === 0) {
  console.log("No UUID-named files to sync.");
  process.exit(0);
}

// 3. Read current featured_video_url for all clips matching those UUIDs in one go.
const ids = [...targetByClipId.keys()];
const inList = ids.map((i) => `"${i}"`).join(",");
const clipsRes = await fetch(
  `${SUPABASE_URL}/rest/v1/clips?id=in.(${inList})&select=id,featured_video_url`,
  { headers: HEADERS }
);
if (!clipsRes.ok) {
  console.error(
    `Supabase GET clips failed: ${clipsRes.status} ${await clipsRes.text()}`
  );
  process.exit(1);
}
const clips = await clipsRes.json();
const currentByClipId = new Map(clips.map((c) => [c.id, c.featured_video_url]));

// 4. Update each clip whose URL doesn't match. PATCH per row keeps it simple.
let updated = 0;
let unchanged = 0;
let missing = 0;
let failed = 0;
for (const [clipId, target] of targetByClipId) {
  const current = currentByClipId.get(clipId);
  if (current === undefined) {
    missing++;
    console.log(`- ${clipId}: no matching DB row (skipping)`);
    continue;
  }
  if (current === target) {
    unchanged++;
    continue;
  }
  const patch = await fetch(
    `${SUPABASE_URL}/rest/v1/clips?id=eq.${clipId}`,
    {
      method: "PATCH",
      headers: { ...HEADERS, Prefer: "return=minimal" },
      body: JSON.stringify({ featured_video_url: target }),
    }
  );
  if (!patch.ok) {
    failed++;
    console.error(`✗ ${clipId}: ${patch.status} ${await patch.text()}`);
    continue;
  }
  updated++;
  console.log(`✓ ${clipId}: linked`);
}

console.log(
  `\nDone. ${updated} updated, ${unchanged} already up-to-date, ${missing} no DB row, ${failed} failed.`
);
