import "server-only";

/**
 * Localized transactional email templates, styled to match Clippa's
 * neobrutalist design system: cream background, 2px ink borders, hard
 * offset "sticker" shadows, bright accent colors per message type.
 *
 * Email-client caveats handled: inline styles only, no web fonts (heavy
 * system stack carries the display feel), box-shadow / border-radius
 * degrade gracefully to flat squares in Outlook.
 *
 * Language is inferred from the creator's `country` (we don't store an
 * explicit locale) — Latin America + Spain ⇒ Spanish, else ⇒ English,
 * null ⇒ Spanish (the user base skews LatAm).
 */

export type EmailLang = "es" | "en";

const SPANISH_COUNTRIES = new Set([
  "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "ES", "GT", "HN", "MX",
  "NI", "PA", "PE", "PR", "PY", "SV", "UY", "VE",
]);

export function localeFromCountry(country?: string | null): EmailLang {
  if (!country) return "es";
  return SPANISH_COUNTRIES.has(country.trim().toUpperCase()) ? "es" : "en";
}

export type RenderedEmail = { subject: string; html: string; text: string };

// Design tokens — mirror app/globals.css.
const CREAM = "#fffcf5";
const INK = "#0a0a0a";
const INK_SOFT = "#4d4d4d";
const LIME = "#c7ff3a";
const MAGENTA = "#ff3d7f";
const PEACH = "#ffd4a8";

const FONT =
  "'Helvetica Neue',Helvetica,Arial,'Segoe UI',Roboto,sans-serif";

// Every email's CTA points back into the creator app.
const APP_URL = "https://clippa.fun/app";

/**
 * Neobrutalist email shell: a cream page, the Clippa wordmark, and one
 * ink-bordered sticker card with a colored banner up top.
 */
function shell(opts: {
  accent: string;
  emoji: string;
  bannerLabel: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:${CREAM};font-family:${FONT};color:${INK};">
<div style="max-width:480px;margin:0 auto;">
  <div style="font-weight:900;font-size:24px;letter-spacing:-0.04em;color:${INK};margin:0 0 20px 4px;">clippa</div>
  <div style="border:2px solid ${INK};border-radius:20px;overflow:hidden;box-shadow:5px 5px 0 0 ${INK};background:${CREAM};">
    <div style="background:${opts.accent};border-bottom:2px solid ${INK};padding:18px 22px;">
      <span style="font-size:26px;vertical-align:middle;">${opts.emoji}</span>
      <span style="font-weight:800;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${INK};vertical-align:middle;margin-left:8px;">${opts.bannerLabel}</span>
    </div>
    <div style="padding:24px 22px;font-size:15px;line-height:1.6;color:${INK};">
${opts.bodyHtml}
    </div>
  </div>
  <p style="margin:20px 0 0 4px;color:${INK_SOFT};font-size:12px;">clippa.fun</p>
</div>
</body></html>`;
}

function heading(text: string): string {
  return `<p style="margin:0 0 12px;font-weight:800;font-size:19px;letter-spacing:-0.02em;color:${INK};">${text}</p>`;
}

/** Ink button with a hard offset shadow in the card's accent color. */
function button(label: string, url: string, accent: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:18px;background:${INK};color:${CREAM};text-decoration:none;font-weight:800;font-size:14px;letter-spacing:0.02em;padding:11px 20px;border:2px solid ${INK};border-radius:10px;box-shadow:3px 3px 0 0 ${accent};">${label}</a>`;
}

/** Inset note block — used for the rejection reason. */
function noteBlock(label: string, value: string): string {
  return `<div style="margin-top:14px;padding:12px 14px;background:${CREAM};border:2px dashed ${INK};border-radius:10px;font-size:14px;">
<span style="font-weight:800;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;">${label}</span><br>
<span style="color:${INK};">${value}</span>
</div>`;
}

export function renderClipApproved(
  lang: EmailLang,
  data: { campaignName: string }
): RenderedEmail {
  const es = lang === "es";
  return {
    subject: es ? "Tu clip fue aprobado ✅" : "Your clip was approved ✅",
    text: es
      ? `Tu clip para ${data.campaignName} fue aprobado. Seguimos las visualizaciones automáticamente y tus ganancias se actualizan cada hora. Te avisaremos cuando llegue tu primer pago. ${APP_URL}`
      : `Your clip for ${data.campaignName} was approved. We automatically track views and update your earnings every hour. We'll let you know when your first payout lands. ${APP_URL}`,
    html: shell({
      accent: LIME,
      emoji: "✅",
      bannerLabel: es ? "Clip aprobado" : "Clip approved",
      bodyHtml: es
        ? `${heading("Ya estás en vivo")}
<p style="margin:0;">Tu clip para <strong>${data.campaignName}</strong> fue aprobado. Seguimos las visualizaciones automáticamente y tus ganancias se actualizan cada hora.</p>
<p style="margin:12px 0 0;color:${INK_SOFT};">Te avisaremos cuando llegue tu primer pago.</p>
${button("Ver mis clips", APP_URL, LIME)}`
        : `${heading("You're live")}
<p style="margin:0;">Your clip for <strong>${data.campaignName}</strong> was approved. We automatically track views and update your earnings every hour.</p>
<p style="margin:12px 0 0;color:${INK_SOFT};">We'll let you know when your first payout lands.</p>
${button("View my clips", APP_URL, LIME)}`,
    }),
  };
}

export function renderClipRejected(
  lang: EmailLang,
  data: { campaignName: string; reason: string }
): RenderedEmail {
  const es = lang === "es";
  return {
    subject: es ? "Tu clip no fue aprobado" : "Your clip wasn't approved",
    text: es
      ? `Tu clip para ${data.campaignName} no fue aprobado esta vez. Motivo: ${data.reason}. Puedes subir otro clip cuando quieras. ${APP_URL}`
      : `Your clip for ${data.campaignName} wasn't approved this time. Reason: ${data.reason}. You can upload another clip anytime. ${APP_URL}`,
    html: shell({
      accent: PEACH,
      emoji: "📋",
      bannerLabel: es ? "Revisión de clip" : "Clip review",
      bodyHtml: es
        ? `${heading("Tu clip no pasó la revisión")}
<p style="margin:0;">Tu clip para <strong>${data.campaignName}</strong> no fue aprobado esta vez.</p>
${noteBlock("Motivo", data.reason)}
<p style="margin:14px 0 0;color:${INK_SOFT};">Puedes subir otro clip cuando quieras.</p>
${button("Subir otro clip", APP_URL, PEACH)}`
        : `${heading("Your clip didn't pass review")}
<p style="margin:0;">Your clip for <strong>${data.campaignName}</strong> wasn't approved this time.</p>
${noteBlock("Reason", data.reason)}
<p style="margin:14px 0 0;color:${INK_SOFT};">You can upload another clip anytime.</p>
${button("Upload another clip", APP_URL, PEACH)}`,
    }),
  };
}

export function renderPayoutSent(
  lang: EmailLang,
  data: { campaignName: string; amount: string }
): RenderedEmail {
  const es = lang === "es";
  return {
    subject: es ? `Recibiste ${data.amount} 💸` : `You received ${data.amount} 💸`,
    text: es
      ? `Tu pago por ${data.campaignName} ya llegó a tu wallet. ${APP_URL}`
      : `Your payout for ${data.campaignName} has arrived in your wallet. ${APP_URL}`,
    html: shell({
      accent: MAGENTA,
      emoji: "💸",
      bannerLabel: es ? "Pago enviado" : "Payout sent",
      bodyHtml: es
        ? `${heading(`Te enviamos ${data.amount}`)}
<p style="margin:0;">Tu pago por <strong>${data.campaignName}</strong> ya llegó a tu wallet.</p>
${button("Ir a Clippa", APP_URL, MAGENTA)}`
        : `${heading(`We sent you ${data.amount}`)}
<p style="margin:0;">Your payout for <strong>${data.campaignName}</strong> has arrived in your wallet.</p>
${button("Open Clippa", APP_URL, MAGENTA)}`,
    }),
  };
}
