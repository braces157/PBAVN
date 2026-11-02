/**
 * The live scoreboard lives on a separate legacy host and answers with an HTML
 * fragment rather than JSON:
 *
 *   GET https://app.pbatour.org/mob/contest_new/code_behind/live_info.asp?TourCode=
 *
 * It returns an empty (CSS-only) fragment whenever no table is being scored,
 * which is the common case. Rather than guess at markup we cannot observe, we
 * extract the readable score lines and let the UI decide how to present them.
 * When the fragment carries nothing useful, `available` is false and the page
 * says so plainly instead of inventing a match.
 */

import { fetchHtmlFragment } from "./http";

export interface LiveFeed {
  available: boolean;
  lines: string[];
  fetchedAt: string;
  source: string;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&middot;": "·",
};

function decode(text: string): string {
  return text.replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ");
}

/** Collapse a fragment into the meaningful text nodes it contains. */
export function extractLines(html: string | null): string[] {
  if (!html) return [];

  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const lines = decode(stripped.replace(/<[^>]+>/g, "\n"))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    // Drop pure CSS/selector debris that leaks out of the legacy templates.
    .filter((line) => !/^[.#][\w-]+\s*\{/.test(line))
    .filter((line) => !/^(padding|margin|border|font|color|background|width|height|display)/i.test(line))
    .filter((line) => line.length > 1);

  // Preserve order but drop duplicates that repeat on every poll.
  return [...new Set(lines)];
}

export async function getLiveFeed(tourCode = ""): Promise<LiveFeed> {
  const html = await fetchHtmlFragment(
    `/mob/contest_new/code_behind/live_info.asp?TourCode=${encodeURIComponent(tourCode)}`,
    { revalidate: 10, timeoutMs: 7_000 },
  );

  const lines = extractLines(html);
  return {
    available: lines.length >= 2,
    lines: lines.slice(0, 40),
    fetchedAt: new Date().toISOString(),
    source: "app.pbatour.org scoreboard",
  };
}
