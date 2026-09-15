import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { AuthModalProvider } from "@/components/AuthModalProvider";
import { Header } from "@/components/Header";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://staynest-henna.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "StayNest — Verified PG, Hostel & Co-living Listings Across India",
  description:
    "Find verified PGs, hostels and co-living spaces across Bangalore, Delhi, Mumbai, Pune, Hyderabad, Chennai and more. Real pricing, photos, amenities and owner contact details on StayNest.",
  keywords:
    "PG near me, paying guest accommodation, hostel for students, co-living spaces, PG in Bangalore, PG in Delhi, PG in Mumbai, PG in Pune, PG in Hyderabad, PG in Chennai, verified PG listings India",
  robots: "index, follow",
  icons: { icon: "/favicon.svg" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "StayNest",
    title: "StayNest — Verified PG, Hostel & Co-living Listings Across India",
    description:
      "Find verified PGs, hostels and co-living spaces across Bangalore, Delhi, Mumbai, Pune, Hyderabad, Chennai and more. Real pricing, photos and amenities.",
    url: siteUrl,
    images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80"],
  },
  twitter: {
    card: "summary_large_image",
    title: "StayNest — Verified PG, Hostel & Co-living Listings Across India",
    description: "Find verified PGs, hostels and co-living spaces across India with real pricing, photos and amenities.",
    images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80"],
  },
  other: {
    "theme-color": "#1d5948",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "StayNest",
  url: siteUrl,
  description: "Find verified PGs, hostels and co-living spaces across India with real pricing, photos and amenities.",
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "StayNest",
  url: siteUrl,
  logo: `${siteUrl}/favicon.svg`,
  description: "StayNest lists verified PG, hostel and co-living accommodation across India with real pricing, amenities and photos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- root layout is the App Router equivalent of _document */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <AuthProvider>
          <AuthModalProvider>
            <Header />
            <main id="app">{children}</main>
            <footer className="site-footer">
              StayNest developed by <strong>Bluerose Technologies</strong>
            </footer>
          </AuthModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
