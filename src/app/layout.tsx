import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

const ibmPlexSans = localFont({
  src: "./fonts/ibm-plex-sans-latin.woff2",
  weight: "400 700",
  variable: "--font-sans",
  display: "swap",
});

const ibmPlexCondensed = localFont({
  src: [
    { path: "./fonts/ibm-plex-condensed-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-condensed-600-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ibm-plex-condensed-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-cond",
  display: "swap",
});

const THEME_INIT = `(function(){try{var t=localStorage.getItem("pba-theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://pba-3c.vercel.app"),
  title: {
    default: "PBA Hub — 3-Cushion Scores, Stats & Standings",
    template: "%s · PBA Hub",
  },
  description:
    "Live 3-cushion carom scores, inning-by-inning match cards, player averages, prize rankings, and Team League standings across the PBA and LPBA tours.",
  applicationName: "PBA Hub",
  keywords: [
    "PBA",
    "LPBA",
    "3-cushion",
    "carom billiards",
    "PBA Hub",
    "Professional Billiards Association",
    "3 cushion stats",
    "PBA Team League",
  ],
  openGraph: {
    title: "PBA Hub — 3-Cushion Scores, Stats & Standings",
    description:
      "Live 3-cushion scores, inning-by-inning match cards, player averages, rankings and Team League standings.",
    type: "website",
    siteName: "PBA Hub",
  },
  twitter: {
    card: "summary_large_image",
    title: "PBA Hub — 3-Cushion Scores, Stats & Standings",
    description:
      "Live 3-cushion scores, inning-by-inning match cards, player averages, rankings and Team League standings.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f2933" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1217" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${ibmPlexSans.variable} ${ibmPlexCondensed.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[3px] focus:bg-[var(--nav)] focus:px-3.5 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="relative min-h-[75vh]">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
