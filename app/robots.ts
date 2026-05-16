import type { MetadataRoute } from "next";

/**
 * Allows every crawler on every path, and points at the canonical host.
 * Mostly here to silence the generic 'could be due to robots.txt block'
 * warning that Facebook / LinkedIn debuggers show when the file is
 * missing — we don't actually block anything.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    host: "https://clippa.fun",
  };
}
