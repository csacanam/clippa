"use client";

import { usePrivy } from "@privy-io/react-auth";

import { useAccessToken } from "@/lib/hooks/use-access-token";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Send } from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { CountryCombobox } from "@/components/country-combobox";
import { LocaleToggle } from "@/components/locale-toggle";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { getMyOnboarding, saveOnboarding } from "@/lib/actions/onboarding";
import { TELEGRAM_URL } from "@/lib/community";

function OnboardingForm() {
  const router = useRouter();
  const { user } = usePrivy();
  const { t } = useTranslation();
  const identityToken = useAccessToken();
  const [country, setCountry] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After saving country, show a Telegram welcome step before sending the
  // creator into the app. Big chance to surface the support channel.
  const [showWelcome, setShowWelcome] = useState(false);

  // If already onboarded, send to /app.
  useEffect(() => {
    let cancelled = false;
    if (!identityToken) return;
    (async () => {
      try {
        const data = await getMyOnboarding(identityToken);
        if (!cancelled && data) router.replace("/app");
      } catch {
        // ignore — user can still complete the form
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identityToken, router]);

  const canSubmit = country.trim().length > 0 && !submitting && !!identityToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !identityToken) return;
    setSubmitting(true);
    setError(null);
    const res = await saveOnboarding(identityToken, { country });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShowWelcome(true);
  };

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <div className="mx-auto flex w-full max-w-xl flex-col">
        <header className="flex items-center justify-between gap-3">
          <ClippaLogo />
          <div className="flex items-center gap-4">
            <LocaleToggle />
            <span className="hidden font-body text-xs text-ink-soft md:inline">
              {user?.email?.address}
            </span>
          </div>
        </header>

        <section className="mt-12 w-full">
        {showWelcome ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Card className="bg-magenta text-cream">
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-full border-2 border-cream/40 bg-cream/15">
                  <Send className="size-7" />
                </div>
                <CardTitle className="text-2xl text-cream md:text-3xl">
                  {t("community.welcomeTitle")}
                </CardTitle>
                <p className="max-w-md text-sm text-cream/90 md:text-base">
                  {t("community.welcomeSubtitle")}
                </p>
                <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
                  <a
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="default" size="lg">
                      {t("community.cta")}
                    </Button>
                  </a>
                  <Button
                    onClick={() => router.replace("/app")}
                    variant="ghost"
                    size="lg"
                    className="text-cream hover:bg-cream/15"
                  >
                    {t("community.welcomeSkip")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                {t("onboarding.heading")}
              </h1>
              <p className="mt-2 font-body text-sm text-ink-soft md:text-base">
                {t("onboarding.subtitle")}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
              className="mt-8"
            >
              <Card>
                <CardContent>
                  <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-2">
                      <label className="font-display text-sm font-bold uppercase tracking-wide">
                        {t("onboarding.countryLabel")}
                      </label>
                      <CountryCombobox value={country} onChange={setCountry} />
                    </div>

                    {error && (
                      <p className="font-body text-sm text-error">{error}</p>
                    )}

                    <div className="flex justify-end pt-2">
                      <Button type="submit" disabled={!canSubmit} size="lg">
                        {submitting
                          ? t("onboarding.saving")
                          : t("onboarding.submit")}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
        </section>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <OnboardingForm />
    </AuthGuard>
  );
}
