import type { MetadataRoute } from "next";

const ROUTES = [
  "",
  "/live",
  "/schedule",
  "/rankings",
  "/players",
  "/teams",
  "/teams/players",
  "/teams/matches",
  "/records",
  "/compare",
  "/news",
  "/about",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pba-3c.vercel.app";
  const lastModified = new Date();
  return ROUTES.map((route, index) => ({
    url: `${base}${route}`,
    lastModified,
    changeFrequency: route === "" || route === "/live" ? "hourly" : "daily",
    priority: index === 0 ? 1 : 0.7,
  }));
}
