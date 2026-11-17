import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

const archivo = localFont({
  src: "./fonts/archivo-latin.woff2",
  weight: "400 900",
  variable: "--font-archivo",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const sourceSerif = localFont({
  src: "./fonts/source-serif-4-latin.woff2",
  weight: "400 700",
  variable: "--font-serif",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "400 700",
  variable: "--font-inter",
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
    { media: "(prefers-color-scheme: light)", color: "#f3efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${archivo.variable} ${sourceSerif.variable} ${inter.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-[var(--ink)] focus:px-3.5 focus:py-2 focus:text-sm focus:font-bold focus:text-[var(--paper)]"
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
