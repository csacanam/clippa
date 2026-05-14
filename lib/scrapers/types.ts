export type ScrapeOk = {
  ok: true;
  views: number;
  /** Caption / description of the post — used to verify tracking codes. */
  caption: string;
  /** Author handle as detected on the post page (best effort). */
  authorHandle?: string;
  /** Canonical post URL resolved by the scraper. Short links (vt.tiktok.com)
   *  resolve to the full www.tiktok.com/@user/video/123 form. Falls back to
   *  the input URL when the scraper doesn't expose one. */
  canonicalUrl?: string;
};

export type ScrapeError = {
  ok: false;
  error: string;
  /** True when the failure is structural (HTML changed, rate-limited, blocked).
   *  Useful for the admin UI to suggest manual review. */
  structural?: boolean;
};

export type ScrapeResult = ScrapeOk | ScrapeError;
