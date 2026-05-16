import "server-only";

/**
 * Campaign content translation via OpenAI's chat completions API.
 *
 * We call the API over fetch (no SDK) to avoid pulling another dependency
 * into the bundle. Structured outputs (json_schema) guarantee the response
 * has the exact shape we need, so no JSON repair is required.
 *
 * Env: OPENAI_API_KEY.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export type TranslatableFields = {
  productName: string;
  shortDescription: string;
  longDescription: string;
  scriptMarkdown: string;
  instructionsMarkdown: string;
};

const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
};

function languageName(code: string): string {
  return LANG_NAMES[code] ?? code;
}

/**
 * Translates a campaign's user-facing copy from one language to another.
 * Throws on API failure — callers should wrap in try/catch and treat
 * translation as best-effort (don't block the campaign activation on it).
 */
export async function translateCampaignFields(
  content: TranslatableFields,
  fromLanguage: string,
  toLanguage: string
): Promise<TranslatableFields> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const systemPrompt = [
    `You translate marketing campaign briefs from ${languageName(fromLanguage)} to ${languageName(toLanguage)}.`,
    "Preserve markdown formatting exactly: **bold**, line breaks, lists, and structural elements like [hook · 0–3s] section headers.",
    "Keep proper nouns unchanged: product names, brand names, URLs, hashtags, @handles.",
    "Keep the tone, voice, and casual register of the original. Match the register a creator would actually use.",
    "Do not add, remove, or reinterpret information — only translate.",
    "Numbers stay as digits, not spelled-out.",
  ].join("\n");

  const userPrompt = JSON.stringify(content);

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
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
  };

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned no content");

  return JSON.parse(raw) as TranslatableFields;
}
