import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cairo } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/settingsServer";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/defaults";
import { buildThemeCss } from "@/lib/theme";
import type { PlatformSettingsData } from "@/db/schema";

export const dynamic = "force-dynamic";

async function loadSettings(): Promise<PlatformSettingsData> {
  try {
    return await getSettings();
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await loadSettings();
  const name = siteName || "NAZMOVIES";
  return {
    ...baseMetadata,
    title: `${name} | أفلام ومسلسلات — Movies & Series`,
    openGraph: { ...baseMetadata.openGraph, siteName: name, title: `${name} — Movies & Series` },
  };
}

const baseMetadata: Metadata = {
  title: "NAZMOVIES | أفلام ناز — منصة الأفلام والمسلسلات السينمائية الفاخرة",
  description:
    "NAZMOVIES (أفلام ناز) — كل أفلامك ومسلسلاتك في مكان واحد. استمتع بمشاهدة أحدث الأفلام والمسلسلات العربية والعالمية بجودة 4K Ultra HD مع تعدد سيرفرات التشغيل والتحميل المباشر.",
  keywords: [
    "NAZMOVIES",
    "أفلام ناز",
    "Naz Movies",
    "أفلام 4K",
    "مسلسلات عربية",
    "مسلسلات أجنبية",
    "منصة أفلام",
    "streaming",
  ],
  openGraph: {
    title: "NAZMOVIES | أفلام ناز — Luxury Cinema Streaming",
    description:
      "كل أفلامك ومسلسلاتك في مكان واحد — Your movies and series, all in one place.",
    type: "website",
    siteName: "NAZMOVIES - أفلام ناز",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await loadSettings();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.siteName || "NAZMOVIES",
    alternateName: "Naz Movies",
    url: "https://nazmovies.example.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://nazmovies.example.com/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <style id="naz-theme" dangerouslySetInnerHTML={{ __html: buildThemeCss(settings) }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${cairo.className} bg-[color:var(--background-color)] text-[color:var(--text-color)] antialiased selection:bg-[color:var(--primary-color)] selection:text-black`}
      >
        {children}
      </body>
    </html>
  );
}
