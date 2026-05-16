/**
 * Backfills campaign_translations for a target language.
 *
 * Iterates every campaign and, for each one missing a translation in
 * <targetLang>, generates one via OpenAI and inserts it. Skips campaigns
 * whose source_language matches the target (they don't need translating).
 *
 * Run once after adding a new locale to SUPPORTED_LOCALES.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node scripts/translate-backfill.mjs <lang>
 *
 * Example:
 *   node scripts/translate-backfill.mjs pt
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, OPENAI_API_KEY.
 */

import { createClient } from "@supabase/supabase-js";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/translate-backfill.mjs <lang>");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET || !OPENAI_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, OPENAI_API_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SECRET, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LANG_NAMES = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
};
const languageName = (c) => LANG_NAMES[c] ?? c;

async function translate(content, fromLang, toLang) {
  const systemPrompt = [
    `You translate marketing campaign briefs from ${languageName(fromLang)} to ${languageName(toLang)}.`,
    "Preserve markdown formatting exactly: **bold**, line breaks, lists, and structural elements like [hook · 0–3s] section headers.",
    "Keep proper nouns unchanged: product names, brand names, URLs, hashtags, @handles.",
    "Keep the tone, voice, and casual register of the original.",
    "Do not add, remove, or reinterpret information — only translate.",
    "Numbers stay as digits, not spelled-out.",
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(content) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "translated_campaign",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              productName: { type: "string" },
              shortDescription: { type: "string" },
              longDescription: { type: "string" },
              scriptMarkdown: { type: "string" },
              instructionsMarkdown: { type: "string" },
            },
            required: [
              "productName",
              "shortDescription",
              "longDescription",
              "scriptMarkdown",
              "instructionsMarkdown",
            ],
          },
        },
      },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content);
}

console.log(`Backfilling translations to '${target}'...`);

const { data: campaigns, error } = await sb
  .from("campaigns")
  .select(
    "id, slug, source_language, product_name, short_description, long_description, script_markdown, instructions_markdown"
  );
if (error) throw error;

let translated = 0;
let skipped = 0;
let failed = 0;

for (const c of campaigns ?? []) {
  if (c.source_language === target) {
    skipped++;
    console.log(`- ${c.slug}: source already ${target}, skipping`);
    continue;
  }

  const existing = await sb
    .from("campaign_translations")
    .select("language")
    .eq("campaign_id", c.id)
    .eq("language", target)
    .maybeSingle();
  if (existing.data) {
    skipped++;
    console.log(`- ${c.slug}: already translated to ${target}, skipping`);
    continue;
  }

  try {
    const out = await translate(
      {
        productName: c.product_name,
        shortDescription: c.short_description,
        longDescription: c.long_description,
        scriptMarkdown: c.script_markdown,
        instructionsMarkdown: c.instructions_markdown,
      },
      c.source_language,
      target
    );
    const ins = await sb.from("campaign_translations").insert({
      campaign_id: c.id,
      language: target,
      product_name: out.productName,
      short_description: out.shortDescription,
      long_description: out.longDescription,
      script_markdown: out.scriptMarkdown,
      instructions_markdown: out.instructionsMarkdown,
    });
    if (ins.error) throw ins.error;
    translated++;
    console.log(`✓ ${c.slug}: translated`);
  } catch (e) {
    failed++;
    console.error(`✗ ${c.slug}: ${e.message}`);
  }
}

console.log(
  `\nDone. ${translated} translated, ${skipped} skipped, ${failed} failed.`
);
