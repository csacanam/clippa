"use client";

import { createContext, useContext, useEffect, useState } from "react";

import en, { type Dict } from "@/lib/i18n/en";
import es from "@/lib/i18n/es";
import { isLocale, type Locale } from "@/lib/i18n/types";

const DICTS: Record<Locale, Dict> = { en, es };

const STORAGE_KEY = "clippa.locale";

type Vars = Record<string, string | number>;

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: string, vars?: Vars) => string;
};

const LocaleContext = createContext<Ctx | null>(null);

function lookup(dict: Dict, path: string): string | undefined {
  const value = path
    .split(".")
    // Walk the dict by key — typed as unknown because the leaves are strings
    // and the intermediate nodes are sub-objects; we don't need full type
    // checking here.
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[key]
          : undefined,
      dict
    );
  return typeof value === "string" ? value : undefined;
}

function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Override server-detected locale with the user's saved preference, if any.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(saved) && saved !== initialLocale) {
        setLocaleState(saved);
      }
    } catch {
      // ignore
    }
  }, [initialLocale]);

  // Keep <html lang> in sync so screen readers + browser spell check follow.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  };

  const dict = DICTS[locale];

  const t = (path: string, vars?: Vars) => {
    const raw = lookup(dict, path);
    if (raw === undefined) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] missing key: ${path}`);
      }
      return path;
    }
    return format(raw, vars);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useTranslation must be used inside <LocaleProvider>");
  }
  return ctx;
}
