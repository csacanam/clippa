import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

import { LocaleProvider } from "@/components/locale-provider";
import { localeFromAcceptLanguage } from "@/lib/i18n/types";

import { Providers } from "./providers";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

// The `?v=` query bumps the browser's favicon cache when the file
// behind the same name has been updated. Bump this when the logo
// changes so users see the new icon without manually clearing cache.
const FAVICON = "/clippa-logo.png?v=2";

const SITE_DESCRIPTION =
  "Make short videos for apps. Post them to your socials. Earn for every view.";

export const metadata: Metadata = {
  metadataBase: new URL("https://clippa.fun"),
  title: "Clippa — Make clips. Get paid.",
  description: SITE_DESCRIPTION,
  icons: {
    icon: [{ url: FAVICON, type: "image/png" }],
    apple: FAVICON,
  },
  openGraph: {
    title: "Clippa — Make clips. Get paid.",
    description: SITE_DESCRIPTION,
    type: "website",
    url: "/",
    images: [
      {
        url: "/creators-og-image.png",
        width: 1200,
        height: 630,
        alt: "Clippa — Make clips. Get paid.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clippa — Make clips. Get paid.",
    description: SITE_DESCRIPTION,
    images: ["/creators-og-image.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Pick the page's initial language from the browser's Accept-Language so
  // the server-rendered HTML is already localized. Users can override with
  // the EN/ES toggle (persisted in localStorage by LocaleProvider).
  const headersList = await headers();
  const initialLocale = localeFromAcceptLanguage(
    headersList.get("accept-language")
  );

  return (
    <html
      lang={initialLocale}
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink font-body">
        <LocaleProvider initialLocale={initialLocale}>
          <Providers>{children}</Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
