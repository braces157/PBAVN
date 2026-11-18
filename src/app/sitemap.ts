import type { MetadataRoute } from "next";
import { calendarEvents } from "@/lib/pba/calendar";
import { siteUrl } from "@/lib/site";

const STATIC_ROUTES = [
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
  const base = siteUrl();
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route, index) => ({
    url: `${base}${route}`,
    changeFrequency: route === "" || route === "/live" ? "hourly" : "daily",
    priority: index === 0 ? 1 : 0.7,
  }));

  const eventEntries: MetadataRoute.Sitemap = calendarEvents().map((event) => ({
    url: `${base}/schedule/${encodeURIComponent(event.id)}`,
    ...(event.end || event.start ? { lastModified: event.end ?? event.start ?? undefined } : {}),
    changeFrequency: event.status === "completed" ? "monthly" : "daily",
    priority: event.status === "live" ? 0.9 : 0.6,
  }));

  return [...staticEntries, ...eventEntries];
}
