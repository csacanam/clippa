import type { Metadata } from "next";

// Brand-side OG / social card. /brands is a client component so it
// can't export metadata itself; this server layout sets it for the
// route, overriding the creator-side OG defined in app/layout.tsx.

const BRAND_TITLE = "Clippa for apps — Get real people talking about your app.";
const BRAND_DESCRIPTION =
  "Create a campaign. Get authentic videos. Reach new users through social media.";

export const metadata: Metadata = {
  title: BRAND_TITLE,
  description: BRAND_DESCRIPTION,
  openGraph: {
    title: BRAND_TITLE,
    description: BRAND_DESCRIPTION,
    type: "website",
    url: "/brands",
    images: [
      {
        url: "/brands-og-image.png",
        width: 1200,
        height: 630,
        alt: BRAND_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_TITLE,
    description: BRAND_DESCRIPTION,
    images: ["/brands-og-image.png"],
  },
};

export default function BrandsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
