"use client";

import { useWallets } from "@privy-io/react-auth";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Coins } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  http,
  type Hex,
} from "viem";
import { celo } from "viem/chains";

import { AuthGuard } from "@/components/auth-guard";
import { CampaignPreview } from "@/components/campaign-preview";
import { ClippaLogo } from "@/components/clippa-logo";
import { useTranslation } from "@/components/locale-provider";
import { MarkdownField } from "@/components/markdown-field";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  isSlugAvailable,
  markCampaignActive,
  reserveCampaignDraft,
  type CampaignDraftInput,
  type ReserveDraftResult,
} from "@/lib/actions/campaigns";
import { type Platform } from "@/lib/campaigns";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import {
  CELO_USDT_ADDRESS,
  CLIPPA_CONTRACT_ADDRESS,
  celoExplorerTx,
  usdToBaseUnits,
  uuidToBytes32,
} from "@/lib/chain";
import { useAccessToken } from "@/lib/hooks/use-access-token";

// ============================================================
// Helpers
// ============================================================

const LANGUAGE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const CLIPPA_WRITE_ABI = [
  {
    type: "function",
    name: "createCampaign",
    stateMutability: "nonpayable",
    inputs: [
      { name: "campaignId", type: "bytes32" },
      { name: "maxPayoutPerClip", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fundCampaign",
    stateMutability: "nonpayable",
    inputs: [
      { name: "campaignId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

function defaultsFor(locale: Locale): FormState {
  return {
    productName: "",
    slug: "",
    shortDescription: "",
    longDescription: "",
    exampleVideoUrl: "",
    scriptMarkdown:
      "**[hook · 0–3s]**\n\nGrab attention here.\n\n**[body · 3–15s]**\n\nShow the product in action.\n\n**[outro · 15–20s]**\n\nClear call to action.",
    instructionsMarkdown:
      "**1. Mention the product on screen at least once.**\nName, URL, or logo.\n\n**2. Keep it authentic.**\nNo fake testimonials or unrealistic results.\n\n**3. Avoid X, Y, Z.**\n[Edit this list.]",
    ratePerViewUsd: "0.01",
    maxPayoutPerClipUsd: "20",
    totalBudgetUsd: "100",
    platforms: { instagram: true, tiktok: true },
    sourceLanguage: locale,
  };
}

type FormState = {
  productName: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  exampleVideoUrl: string;
  scriptMarkdown: string;
  instructionsMarkdown: string;
  ratePerViewUsd: string;
  maxPayoutPerClipUsd: string;
  totalBudgetUsd: string;
  platforms: { instagram: boolean; tiktok: boolean };
  sourceLanguage: Locale;
};

function formToInput(f: FormState): CampaignDraftInput {
  const platforms: Platform[] = [];
  if (f.platforms.instagram) platforms.push("instagram");
  if (f.platforms.tiktok) platforms.push("tiktok");
  return {
    sourceLanguage: f.sourceLanguage,
    productName: f.productName.trim(),
    slug: f.slug.trim(),
    shortDescription: f.shortDescription.trim(),
    longDescription: f.longDescription.trim(),
    exampleVideoUrl: f.exampleVideoUrl.trim() || undefined,
    scriptMarkdown: f.scriptMarkdown,
    instructionsMarkdown: f.instructionsMarkdown,
    ratePerViewUsd: Number(f.ratePerViewUsd),
    maxPayoutPerClipUsd: Number(f.maxPayoutPerClipUsd),
    totalBudgetUsd: Number(f.totalBudgetUsd),
    platforms,
  };
}

// ============================================================
// Page
// ============================================================

type TxStage =
  | { kind: "idle" }
  | { kind: "approving" }
  | { kind: "creating"; approveTx?: string }
  | { kind: "funding"; approveTx?: string; createTx: string }
  | { kind: "finalizing"; approveTx?: string; createTx: string; fundTx: string }
  | { kind: "done"; approveTx?: string; createTx: string; fundTx: string }
  | { kind: "error"; message: string };

function NewCampaignWizard() {
  const router = useRouter();
  const identityToken = useAccessToken();
  const { wallets } = useWallets();

  const [step, setStep] = useState<1 | 2>(1);
  const { t, locale } = useTranslation();
  const [form, setForm] = useState<FormState>(() => defaultsFor(locale));
  const [errors, setErrors] = useState<Partial<Record<keyof CampaignDraftInput, string>>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">(
    "idle"
  );
  const [reserving, setReserving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [stage, setStage] = useState<TxStage>({ kind: "idle" });

  // Auto-fill slug from product name until the user edits it manually.
  useEffect(() => {
    if (!slugTouched) {
      setForm((f) => ({ ...f, slug: slugify(f.productName) }));
    }
  }, [form.productName, slugTouched]);

  // Debounced slug availability check.
  useEffect(() => {
    if (!form.slug) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const ok = await isSlugAvailable(form.slug);
        setSlugStatus(ok ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [form.slug]);

  const platformsValid = form.platforms.instagram || form.platforms.tiktok;
  const fundAmount = Number(form.totalBudgetUsd);
  const fundAmountValid = Number.isFinite(fundAmount) && fundAmount > 0;

  const handleNext = async () => {
    if (!identityToken) return;
    setErrors({});
    setReserving(true);
    try {
      const result: ReserveDraftResult = await reserveCampaignDraft(
        identityToken,
        formToInput(form)
      );
      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: result.error });
        else setErrors({ slug: result.error });
        return;
      }
      setDraftId(result.id);
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setReserving(false);
    }
  };

  const handleFund = async () => {
    if (!identityToken || !draftId) return;
    if (!CLIPPA_CONTRACT_ADDRESS) {
      setStage({
        kind: "error",
        message: t("brand.errContractNotConfigured"),
      });
      return;
    }
    try {
      const wallet =
        wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      if (!wallet) throw new Error(t("brand.errNoWallet"));
      try {
        await wallet.switchChain(celo.id);
      } catch {
        /* already on celo or auto-switched */
      }

      const provider = await wallet.getEthereumProvider();
      const account = wallet.address as Hex;
      const walletClient = createWalletClient({
        account,
        chain: celo,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: celo,
        transport: http(),
      });

      const campaignId = uuidToBytes32(draftId);
      const fundUnits = usdToBaseUnits(fundAmount);
      const maxPayoutUnits = usdToBaseUnits(Number(form.maxPayoutPerClipUsd));

      // 1. Skip approve if existing allowance already covers fundUnits.
      const allowance = (await publicClient.readContract({
        address: CELO_USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, CLIPPA_CONTRACT_ADDRESS],
      })) as bigint;

      let approveTx: string | undefined;
      if (allowance < fundUnits) {
        setStage({ kind: "approving" });
        approveTx = await walletClient.writeContract({
          address: CELO_USDT_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [CLIPPA_CONTRACT_ADDRESS, fundUnits],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx as Hex });
      }

      // 2. createCampaign.
      setStage({ kind: "creating", approveTx });
      const createTx = await walletClient.writeContract({
        address: CLIPPA_CONTRACT_ADDRESS,
        abi: CLIPPA_WRITE_ABI,
        functionName: "createCampaign",
        args: [campaignId, maxPayoutUnits],
      });
      await publicClient.waitForTransactionReceipt({ hash: createTx as Hex });

      // 3. fundCampaign.
      setStage({ kind: "funding", approveTx, createTx });
      const fundTx = await walletClient.writeContract({
        address: CLIPPA_CONTRACT_ADDRESS,
        abi: CLIPPA_WRITE_ABI,
        functionName: "fundCampaign",
        args: [campaignId, fundUnits],
      });
      await publicClient.waitForTransactionReceipt({ hash: fundTx as Hex });

      // 4. Flip DB to active.
      setStage({ kind: "finalizing", approveTx, createTx, fundTx });
      const r = await markCampaignActive(identityToken, draftId);
      if (!r.ok) throw new Error(r.error);

      setStage({ kind: "done", approveTx, createTx, fundTx });
    } catch (e) {
      const raw = (e as Error).message ?? "Something went wrong.";
      let message = raw.slice(0, 200);
      if (/rejected|denied/i.test(raw)) message = t("brand.errSigningCancelled");
      else if (/insufficient/i.test(raw))
        message = t("brand.errInsufficientFunds");
      setStage({ kind: "error", message });
    }
  };

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClippaLogo />
          <Badge variant="indigo" className="px-2.5 py-1 text-[0.7rem]">
            {t("brand.badgeBrand")}
          </Badge>
        </div>
        <Link
          href="/brand"
          className="font-body text-sm font-medium text-ink-soft underline-offset-4 hover:underline"
        >
          {t("brand.backToDashboard")}
        </Link>
      </header>

      <section className="mx-auto mt-8 w-full max-w-3xl">
        <StepIndicator step={step} />

        {step === 1 ? (
          <StepOne
            form={form}
            setForm={setForm}
            errors={errors}
            slugTouched={slugTouched}
            setSlugTouched={setSlugTouched}
            slugStatus={slugStatus}
            platformsValid={platformsValid}
            fundAmountValid={fundAmountValid}
            reserving={reserving}
            onNext={handleNext}
          />
        ) : (
          <StepTwo
            form={form}
            fundAmount={fundAmount}
            stage={stage}
            onBack={() => {
              if (stage.kind === "idle" || stage.kind === "error") setStep(1);
            }}
            onFund={handleFund}
            onDone={() => router.push("/brand")}
          />
        )}
      </section>
    </main>
  );
}

// ============================================================
// Step indicator
// ============================================================

function StepIndicator({ step }: { step: 1 | 2 }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <StepDot n={1} active={step === 1} done={step === 2} label={t("brand.wizStep1")} />
      <div className="h-px flex-1 bg-ink/15" />
      <StepDot n={2} active={step === 2} done={false} label={t("brand.wizStep2")} />
    </div>
  );
}

function StepDot({
  n,
  active,
  done,
  label,
}: {
  n: number;
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex size-7 items-center justify-center rounded-full border-2 border-ink font-display text-sm font-bold ${
          active ? "bg-lime text-ink" : done ? "bg-ink text-cream" : "bg-cream text-ink-soft"
        }`}
      >
        {done ? <Check className="size-3.5" /> : n}
      </div>
      <span
        className={`font-display text-xs font-bold uppercase tracking-wider ${
          active || done ? "text-ink" : "text-ink-soft"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ============================================================
// Step 1 — Form
// ============================================================

function StepOne({
  form,
  setForm,
  errors,
  slugTouched,
  setSlugTouched,
  slugStatus,
  platformsValid,
  fundAmountValid,
  reserving,
  onNext,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Partial<Record<keyof CampaignDraftInput, string>>;
  slugTouched: boolean;
  setSlugTouched: (v: boolean) => void;
  slugStatus: "idle" | "checking" | "available" | "taken";
  platformsValid: boolean;
  fundAmountValid: boolean;
  reserving: boolean;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const slugHint =
    slugStatus === "checking"
      ? t("brand.fldSlugHintChecking")
      : slugStatus === "available"
        ? t("brand.fldSlugHintAvailable", { slug: form.slug })
        : slugStatus === "taken"
          ? t("brand.fldSlugHintTaken")
          : t("brand.fldSlugHintIdle");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mt-8 flex flex-col gap-6"
    >
      <Card className="bg-cream">
        <CardContent className="flex flex-col gap-5">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {t("brand.wizSectionPromoting")}
          </h2>

          <Field
            label={t("brand.fldLanguage")}
            error={errors.sourceLanguage}
            hint={t("brand.fldLanguageHint")}
          >
            <div className="flex flex-wrap gap-3">
              {LOCALES.map((loc) => (
                <PlatformChip
                  key={loc}
                  label={LANGUAGE_LABELS[loc]}
                  checked={form.sourceLanguage === loc}
                  onChange={(v) => {
                    if (v) update("sourceLanguage", loc);
                  }}
                />
              ))}
            </div>
          </Field>

          <Field
            label={t("brand.fldProductName")}
            error={errors.productName}
            hint={t("brand.fldProductNameHint")}
          >
            <Input
              value={form.productName}
              onChange={(e) => update("productName", e.target.value)}
              placeholder="Nerdos.fun"
              maxLength={60}
            />
          </Field>

          <Field
            label={t("brand.fldSlug")}
            error={errors.slug}
            hint={slugHint}
            hintColor={
              slugStatus === "available"
                ? "text-success"
                : slugStatus === "taken"
                  ? "text-error"
                  : undefined
            }
          >
            <Input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              placeholder="nerdos-fun"
              maxLength={40}
            />
          </Field>

          <Field
            label={t("brand.fldTagline")}
            error={errors.shortDescription}
            hint={t("brand.fldTaglineHint")}
          >
            <Input
              value={form.shortDescription}
              onChange={(e) => update("shortDescription", e.target.value)}
              placeholder="A daily game where curious people compete and win rewards."
              maxLength={200}
            />
          </Field>

          <Field
            label={t("brand.fldAbout")}
            error={errors.longDescription}
            hint={t("brand.fldAboutHint")}
          >
            <textarea
              value={form.longDescription}
              onChange={(e) => update("longDescription", e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Nerdos.fun is a daily game where players answer quick questions and win real money. We want creators to show the game in action — make viewers curious enough to try it. The best clips feel like a personal discovery."
              className="w-full resize-y rounded-md border-2 border-ink bg-cream px-3 py-2 font-body text-sm leading-relaxed text-ink shadow-sticker outline-none focus:ring-4 focus:ring-ring/40"
            />
          </Field>

          <Field
            label={t("brand.fldReferenceVideo")}
            error={errors.exampleVideoUrl}
            hint={t("brand.fldReferenceVideoHint")}
          >
            <Input
              value={form.exampleVideoUrl}
              onChange={(e) => update("exampleVideoUrl", e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="bg-cream">
        <CardContent className="flex flex-col gap-5">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {t("brand.wizSectionBrief")}
          </h2>

          <Field
            label={t("brand.fldScript")}
            error={errors.scriptMarkdown}
            hint={t("brand.fldScriptHint")}
          >
            <MarkdownField
              value={form.scriptMarkdown}
              onChange={(v) => update("scriptMarkdown", v)}
              rows={10}
              maxLength={5000}
            />
          </Field>

          <Field
            label={t("brand.fldRules")}
            error={errors.instructionsMarkdown}
            hint={t("brand.fldRulesHint")}
          >
            <MarkdownField
              value={form.instructionsMarkdown}
              onChange={(v) => update("instructionsMarkdown", v)}
              rows={8}
              maxLength={5000}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="bg-cream">
        <CardContent className="flex flex-col gap-5">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {t("brand.wizSectionMoney")}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field
              label={t("brand.fldRatePerView")}
              error={errors.ratePerViewUsd}
              hint={t("brand.fldRatePerViewHint")}
            >
              <Input
                type="number"
                inputMode="decimal"
                step="0.0001"
                min="0"
                value={form.ratePerViewUsd}
                onChange={(e) => update("ratePerViewUsd", e.target.value)}
              />
            </Field>
            <Field
              label={t("brand.fldMaxPerClip")}
              error={errors.maxPayoutPerClipUsd}
              hint={t("brand.fldMaxPerClipHint")}
            >
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min="1"
                value={form.maxPayoutPerClipUsd}
                onChange={(e) => update("maxPayoutPerClipUsd", e.target.value)}
              />
            </Field>
            <Field
              label={t("brand.fldTotalBudget")}
              error={errors.totalBudgetUsd}
              hint={t("brand.fldTotalBudgetHint")}
            >
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min="1"
                value={form.totalBudgetUsd}
                onChange={(e) => update("totalBudgetUsd", e.target.value)}
              />
            </Field>
          </div>

          <Field
            label={t("brand.fldPlatforms")}
            error={errors.platforms}
            hint={t("brand.fldPlatformsHint")}
          >
            <div className="flex flex-wrap gap-3">
              <PlatformChip
                label="Instagram"
                checked={form.platforms.instagram}
                onChange={(v) =>
                  setForm((f) => ({ ...f, platforms: { ...f.platforms, instagram: v } }))
                }
              />
              <PlatformChip
                label="TikTok"
                checked={form.platforms.tiktok}
                onChange={(v) =>
                  setForm((f) => ({ ...f, platforms: { ...f.platforms, tiktok: v } }))
                }
              />
            </div>
            {!platformsValid && (
              <p className="text-xs text-error">{t("brand.fldPlatformsRequired")}</p>
            )}
          </Field>
        </CardContent>
      </Card>

      <Card className="bg-cream">
        <CardContent className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">
              {t("brand.wizSectionPreview")}
            </h2>
            <p className="mt-1 font-body text-sm text-ink-soft">
              {t("brand.wizSectionPreviewHint")}
            </p>
          </div>
          <CampaignPreview
            data={{
              productName: form.productName,
              shortDescription: form.shortDescription,
              longDescription: form.longDescription,
              scriptMarkdown: form.scriptMarkdown,
              instructionsMarkdown: form.instructionsMarkdown,
              ratePerViewUsd: Number(form.ratePerViewUsd) || 0,
              maxPayoutPerClipUsd: Number(form.maxPayoutPerClipUsd) || 0,
              totalBudgetUsd: Number(form.totalBudgetUsd) || 0,
              platforms: [
                ...(form.platforms.instagram ? (["instagram"] as const) : []),
                ...(form.platforms.tiktok ? (["tiktok"] as const) : []),
              ],
            }}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={
            reserving ||
            !platformsValid ||
            !fundAmountValid ||
            slugStatus === "taken" ||
            slugStatus === "checking"
          }
          variant="default"
          size="lg"
        >
          {reserving ? t("brand.wizBtnReserving") : t("brand.wizBtnNext")}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  error,
  hint,
  hintColor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  hintColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-display text-sm font-bold uppercase tracking-wide">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-error">{error}</p>
      ) : hint ? (
        <p className={`text-xs ${hintColor ?? "text-ink-soft"}`}>{hint}</p>
      ) : null}
    </div>
  );
}

function PlatformChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
        checked ? "bg-indigo text-cream" : "bg-cream text-ink hover:bg-peach/60"
      }`}
    >
      {checked && <Check className="size-3" />}
      {label}
    </button>
  );
}

// ============================================================
// Step 2 — Review + Fund
// ============================================================

function StepTwo({
  form,
  fundAmount,
  stage,
  onBack,
  onFund,
  onDone,
}: {
  form: FormState;
  fundAmount: number;
  stage: TxStage;
  onBack: () => void;
  onFund: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const platforms = useMemo(() => {
    const out: string[] = [];
    if (form.platforms.instagram) out.push("Instagram");
    if (form.platforms.tiktok) out.push("TikTok");
    return out.join(", ");
  }, [form.platforms]);

  const busy =
    stage.kind === "approving" ||
    stage.kind === "creating" ||
    stage.kind === "funding" ||
    stage.kind === "finalizing";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mt-8 flex flex-col gap-6"
    >
      <Card className="bg-cream">
        <CardContent className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {t("brand.reviewTermsTitle")}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ReviewRow label={t("brand.reviewProduct")} value={form.productName} />
            <ReviewRow label={t("brand.reviewSlug")} value={form.slug} mono />
            <ReviewRow label={t("brand.reviewPlatforms")} value={platforms} />
            <ReviewRow label={t("brand.reviewTagline")} value={form.shortDescription} />
          </div>
          <div className="grid grid-cols-1 gap-3 border-t-2 border-ink/10 pt-3 md:grid-cols-3">
            <ReviewRow label={t("brand.reviewRatePerView")} value={`$${form.ratePerViewUsd}`} />
            <ReviewRow label={t("brand.reviewMaxPerClip")} value={`$${form.maxPayoutPerClipUsd}`} />
            <ReviewRow label={t("brand.reviewTotalBudget")} value={`$${form.totalBudgetUsd}`} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-cream">
        <CardContent className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">
              {t("brand.reviewPreviewTitle")}
            </h2>
            <p className="mt-1 font-body text-sm text-ink-soft">
              {t("brand.reviewPreviewHint")}
            </p>
          </div>
          <CampaignPreview
            data={{
              productName: form.productName,
              shortDescription: form.shortDescription,
              longDescription: form.longDescription,
              scriptMarkdown: form.scriptMarkdown,
              instructionsMarkdown: form.instructionsMarkdown,
              ratePerViewUsd: Number(form.ratePerViewUsd) || 0,
              maxPayoutPerClipUsd: Number(form.maxPayoutPerClipUsd) || 0,
              totalBudgetUsd: Number(form.totalBudgetUsd) || 0,
              platforms: [
                ...(form.platforms.instagram ? (["instagram"] as const) : []),
                ...(form.platforms.tiktok ? (["tiktok"] as const) : []),
              ],
            }}
          />
        </CardContent>
      </Card>

      <Card className="bg-peach">
        <CardContent className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {t("brand.fundTitle")}
          </h2>
          <p className="font-body text-sm text-ink-soft">
            {t("brand.fundExplainer")}
          </p>

          <div className="mt-2 rounded-md border-2 border-ink bg-cream p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                {t("brand.fundAmount")}
              </span>
              <span className="font-display text-2xl font-bold tracking-tight">
                ${fundAmount.toFixed(2)}
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between text-sm">
              <span className="text-ink-soft">{t("brand.fundGoesTo")}</span>
              <span className="font-mono font-bold">${fundAmount.toFixed(2)}</span>
            </div>
            <p className="mt-3 text-[0.7rem] text-ink-soft">
              {t("brand.fundUsdtNote")}
            </p>
          </div>

          <TxProgress stage={stage} />

          {stage.kind === "done" ? (
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex flex-col items-center gap-2 rounded-md border-2 border-ink bg-lime p-4 text-center">
                <Check className="size-6" />
                <p className="font-display text-lg font-bold tracking-tight">
                  {t("brand.fundDoneTitle")}
                </p>
                <p className="text-sm text-ink-soft">
                  {t("brand.fundDoneBody")}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
                  <a
                    href={celoExplorerTx(stage.fundTx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo hover:underline"
                  >
                    {t("brand.fundDoneReceipt")}
                    <ArrowUpRight className="size-3" />
                  </a>
                </div>
              </div>
              <Button onClick={onDone} variant="default" size="lg">
                {t("brand.fundDoneCta")}
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              <Button
                onClick={onBack}
                disabled={busy}
                variant="ghost"
                size="default"
              >
                <ArrowLeft className="size-4" />
                {t("brand.fundBtnEdit")}
              </Button>
              <Button
                onClick={onFund}
                disabled={busy}
                variant="default"
                size="lg"
              >
                <Coins className={`size-4 ${busy ? "animate-pulse" : ""}`} />
                {busy ? t("brand.fundBtnConfirming") : t("brand.fundBtnConfirm")}
              </Button>
            </div>
          )}

          {stage.kind === "error" && (
            <p className="text-sm text-error">{stage.message}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ReviewRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      <span className={`text-sm ${mono ? "font-mono" : "font-body"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function TxProgress({ stage }: { stage: TxStage }) {
  const { t: tr } = useTranslation();
  if (stage.kind === "idle" || stage.kind === "error") return null;
  const txs: { label: string; status: "pending" | "active" | "done" }[] = [
    {
      label: tr("brand.fundTxApprove"),
      status:
        stage.kind === "approving"
          ? "active"
          : "approveTx" in stage && stage.approveTx
            ? "done"
            : "done",
    },
    {
      label: tr("brand.fundTxCreate"),
      status:
        stage.kind === "approving"
          ? "pending"
          : stage.kind === "creating"
            ? "active"
            : "done",
    },
    {
      label: tr("brand.fundTxSend"),
      status:
        stage.kind === "funding"
          ? "active"
          : stage.kind === "finalizing" || stage.kind === "done"
            ? "done"
            : "pending",
    },
  ];

  return (
    <ol className="flex flex-col gap-1.5 rounded-md border-2 border-ink bg-cream p-3 text-sm">
      {txs.map((t, i) => (
        <li key={i} className="flex items-center gap-2">
          <span
            className={`flex size-5 items-center justify-center rounded-full border-2 border-ink text-[10px] font-bold ${
              t.status === "done"
                ? "bg-lime"
                : t.status === "active"
                  ? "bg-peach animate-pulse"
                  : "bg-cream text-ink-soft"
            }`}
          >
            {t.status === "done" ? <Check className="size-3" /> : i + 1}
          </span>
          <span className={t.status === "pending" ? "text-ink-soft" : ""}>
            {t.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ============================================================
// Export
// ============================================================

export default function NewCampaignPage() {
  return (
    <AuthGuard redirectTo="/brands">
      <NewCampaignWizard />
    </AuthGuard>
  );
}
