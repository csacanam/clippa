/**
 * Apify HTTP client with automatic token rotation.
 *
 * Apify's free tier gives every account $5/month of credits. We pool
 * multiple free accounts via APIFY_API_TOKEN (primary) plus optional
 * APIFY_API_TOKEN_2, APIFY_API_TOKEN_3, ... — when one hits its monthly
 * "hard usage limit" and returns 403, this helper rotates to the next
 * token and retries the same call. The cursor advances so subsequent
 * calls in the same process skip the exhausted token directly.
 *
 * When all tokens are exhausted the last 403 is surfaced to the caller.
 */

function loadTokens(): string[] {
  const out: string[] = [];
  const primary = process.env.APIFY_API_TOKEN;
  if (primary) out.push(primary);
  for (let i = 2; i <= 10; i++) {
    const t = process.env[`APIFY_API_TOKEN_${i}`];
    if (t) out.push(t);
  }
  return out;
}

const TOKENS = loadTokens();
let cursor = 0;

export function hasApifyTokens(): boolean {
  return TOKENS.length > 0;
}

export type ApifyCallResult = { status: number; body: string };

/**
 * POST to an Apify actor's run-sync endpoint. The actor path is the bit
 * after `/v2/acts/` — e.g. `clockworks~tiktok-scraper/run-sync-get-dataset-items`.
 *
 * Returns the raw status + body string; callers parse JSON if status is 2xx.
 * Throws only on unrecoverable cases (no tokens configured); ordinary HTTP
 * errors come back via the returned status.
 */
export async function callApifyActor(
  actorPath: string,
  body: unknown,
  opts: { signal?: AbortSignal } = {}
): Promise<ApifyCallResult> {
  if (TOKENS.length === 0) {
    throw new Error("APIFY_API_TOKEN is not configured");
  }
  let last: ApifyCallResult | null = null;
  for (let i = 0; i < TOKENS.length; i++) {
    const idx = (cursor + i) % TOKENS.length;
    const token = TOKENS[idx];
    const url =
      `https://api.apify.com/v2/acts/${actorPath}?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    const text = await res.text();
    if (res.status === 403 && text.includes("Monthly usage hard limit")) {
      console.warn(
        `[apify] token #${idx + 1} quota exhausted; rotating to next`
      );
      cursor = (idx + 1) % TOKENS.length;
      last = { status: res.status, body: text };
      continue;
    }
    return { status: res.status, body: text };
  }
  return last!;
}
