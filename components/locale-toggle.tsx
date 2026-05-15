"use client";

import { LOCALES, type Locale } from "@/lib/i18n/types";
import { useTranslation } from "@/components/locale-provider";

/**
 * Pill-style EN | ES switcher for headers. Persists to localStorage via the
 * LocaleProvider, so the choice carries between pages and sessions.
 */
export function LocaleToggle() {
  const { locale, setLocale } = useTranslation();
  return (
    <div className="flex items-center gap-0.5 rounded-full border-2 border-ink bg-cream p-0.5 text-[0.65rem] font-display font-bold uppercase tracking-wider">
      {LOCALES.map((l: Locale) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            className={
              "rounded-full px-2 py-0.5 transition-colors " +
              (active
                ? "bg-ink text-cream"
                : "text-ink-soft hover:text-ink")
            }
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
