"use client";

import { usePrivy } from "@privy-io/react-auth";

import { useAccessToken } from "@/lib/hooks/use-access-token";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { CountryCombobox } from "@/components/country-combobox";
import { LocaleToggle } from "@/components/locale-toggle";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyOnboarding, saveOnboarding } from "@/lib/actions/onboarding";

function OnboardingForm() {
  const router = useRouter();
  const { user } = usePrivy();
  const { t } = useTranslation();
  const identityToken = useAccessToken();
  const [country, setCountry] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.replace("/app");
  };

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <header className="flex items-center justify-between">
        <ClippaLogo />
        <div className="flex items-center gap-4">
          <LocaleToggle />
          <span className="hidden font-body text-xs text-ink-soft md:inline">
            {user?.email?.address}
          </span>
        </div>
      </header>

      <section className="mx-auto mt-12 w-full max-w-xl">
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
      </section>
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
