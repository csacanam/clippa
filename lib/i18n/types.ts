export type Locale = "en" | "es";

export const LOCALES: Locale[] = ["en", "es"];

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "es";
}

/**
 * Picks a locale from an Accept-Language header. Spanish if the top
 * preference is es-*, English otherwise. Used in the root layout so the
 * server-rendered HTML already has the right language.
 */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return "en";
  const first = header.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("es")) return "es";
  return "en";
}
