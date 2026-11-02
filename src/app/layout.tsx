import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
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
