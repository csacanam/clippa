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

export const metadata: Metadata = {
  title: "Clippa — Make clips. Get paid.",
  description:
    "Make short videos for apps. Post them to your socials. Earn for every view.",
  icons: {
    icon: [
      { url: "/clippa-logo.png", type: "image/png" },
    ],
    apple: "/clippa-logo.png",
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
