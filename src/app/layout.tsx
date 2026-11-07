import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

/**
 * Fonts are vendored rather than fetched from Google at build time. `next/font/google`
 * reaches out during `next build`, which fails on a firewall or when Google throttles
 * CI. These two files are the latin variable subsets (81 KB together).
 */
const archivo = localFont({
  src: "./fonts/archivo-latin.woff2",
  weight: "400 800",
  variable: "--font-archivo",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "400 700",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  // Relative OG/social URLs resolve against this. The canonical host is
  // whatever this deployment runs on — set NEXT_PUBLIC_SITE_URL there.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  title: {
    default: "PBA Hub — Professional Billiards Association",
    template: "%s · PBA Hub",
  },
  description:
    "Live scores, player statistics, team standings, rankings and the full PBA / LPBA tour schedule — a modern reader for the Professional Billiards Association tour.",
  applicationName: "PBA Hub",
  keywords: [
    "PBA",
    "Professional Billiards Association",
    "LPBA",
    "3-cushion",
    "carom billiards",
    "billiards statistics",
    "PBA tour schedule",
  ],
  openGraph: {
    title: "PBA Hub — Professional Billiards Association",
    description:
      "Live scores, player statistics, team standings, rankings and the full PBA / LPBA tour schedule.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#040507",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-lime-400 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="relative">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
