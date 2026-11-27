import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { siteUrl } from "@/lib/site";

const THEME_INIT = `(function(){var t=null;try{t=localStorage.getItem("pba-theme");}catch(e){}if(t!=="dark"&&t!=="light"){try{t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}catch(e){t="light";}}try{var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
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
    { media: "(prefers-color-scheme: light)", color: "#0A1A30" },
    { media: "(prefers-color-scheme: dark)", color: "#071222" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
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
