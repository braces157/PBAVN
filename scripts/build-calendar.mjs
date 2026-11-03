// Rebuilds src/lib/pba/data/calendar.json — the pre-shared event calendar the
// console home, schedule index, standings and event headers read from.
//
//   npm run build-calendar
//
// Why a file and not a request: the schedule index needs every season at once
// (eight of them, ~270 events) to put a date rail and a season picker on one
// screen, and eight upstream calls per render is not a page load. The calendar
// only changes when the association publishes or moves a date, so it is
// refreshed deliberately and shipped with the build — the same contract as the
// tour-title and player-name indexes next to it.
//
// Per-event details that move daily (match codes, champions, live status) are
// NOT baked in: detail pages still read those from the live feed.

import { mkdirSync, writeFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { rootCertificates } from "node:tls";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GLOBALSIGN_GCCR46_ALPHASSLCA2025_PEM } from "../src/lib/pba/certs.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "src", "lib", "pba", "data", "calendar.json");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "X-Requested-With": "XMLHttpRequest",
  Referer: "https://www.pbatour.org/en/index",
};

// The upstream omits its intermediate certificate, so pin it the same way
// http.ts does; a `ca` list replaces Node's default store, so the bundled
// roots ride along.
function getJson(url) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = httpsRequest(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        headers: { ...HEADERS, "Accept-Encoding": "identity" },
        ca: [...rootCertificates, GLOBALSIGN_GCCR46_ALPHASSLCA2025_PEM],
        timeout: 120_000,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

function rows(envelope) {
  if (!envelope) return [];
  if (Array.isArray(envelope.list)) return envelope.list;
  if (envelope.result && Array.isArray(envelope.result.list)) return envelope.result.list;
  return [];
}

const MONTHS = {
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};

/** The feed's date objects → `YYYY-MM-DD`, exactly as the app reads them. */
function iso(value) {
  if (!value) return null;
  if (value.year && value.monthValue && value.dayOfMonth) {
    const month = String(value.monthValue).padStart(2, "0");
    const day = String(value.dayOfMonth).padStart(2, "0");
    return `${value.year}-${month}-${day}`;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
}

const PLACEHOLDERS = /^(tbd|tba|n\/a|none|null|undefined|-|—|미정|없음)$/i;
function clean(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || PLACEHOLDERS.test(text)) return null;
  return text;
}
function pick(en, ko) {
  return clean(en) ?? clean(ko);
}

/** `tournament/…` and `tournament/tournament/…` both mean the same file. */
function logoPath(value) {
  const path = clean(value)?.replace(/^\/+/, "");
  if (!path) return null;
  const normalised = path.startsWith("tournament/tournament/")
    ? path.slice("tournament/".length)
    : path;
  return `/tournament/${normalised.replace(/^tournament\//, "")}`;
}

const seasons = rows(
  await getJson("https://www.pbatour.org/en/tournament/schedule/ajax/season"),
);
if (seasons.length === 0) {
  console.error("the season feed answered empty; refusing to overwrite the calendar");
  process.exit(1);
}

const events = [];
const empty = [];

for (const season of seasons) {
  const list = rows(
    await getJson(
      `https://www.pbatour.org/en/tournament/schedule/ajax/list?langCode=ko&season=${encodeURIComponent(
        season.SeasonCode,
      )}`,
    ),
  );
  if (list.length === 0) {
    empty.push(season.SeasonCode);
    continue;
  }

  for (const raw of list) {
    const title = pick(raw.TITLE_EN, raw.TITLE);
    if (!title) continue;
    const start = iso(raw.MATCH_START_DATE);
    events.push({
      id: raw.SEQ,
      title,
      league: raw.LEAGUE_GUBUN ?? "",
      season: raw.SEASON_GUBUN || season.SeasonCode,
      start,
      end: iso(raw.MATCH_END_DATE) ?? start,
      venue: pick(raw.PLACE_EN, raw.PLACE),
      sponsor: pick(raw.SPONSOR_EN, raw.SPONSOR),
      prizePool: pick(raw.TOTAL_PRIZE_EN, raw.TOTAL_PRIZE),
      championPrize: pick(raw.WINNING_PRIZE_EN, raw.WINNING_PRIZE),
      defendingChampion: pick(raw.PREV_WINNER_NAME_EN, raw.PREV_WINNER_NAME),
      players: Number(raw.JOIN_PLAYER) > 0 ? Number(raw.JOIN_PLAYER) : null,
      teams: Number(raw.JOIN_TEAM) > 0 ? Number(raw.JOIN_TEAM) : null,
      // Kept as the upstream asset path; the app resizes it through /api/photo.
      // The field is inconsistent: some rows carry `tournament/…`, others the
      // already-prefixed `tournament/tournament/…`, so the prefix is collapsed.
      logoPath: logoPath(raw.SPONSOR_LOGO_FILE_PATH),
      guideUrl: clean(raw.TOURNAMENT_GUIDE_URL_EN) ?? null,
      top: raw.TOP_YN === 1,
    });
  }

  process.stdout.write(`  ${season.SeasonCode}: ${list.length}\n`);
}

if (events.length === 0) {
  console.error("no events came back; refusing to overwrite the calendar");
  process.exit(1);
}

events.sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999"));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(events)}\n`, "utf8");

console.log(`\n${OUT}`);
console.log(`${events.length} events across ${seasons.length} seasons`);
console.log(`range ${events[0].start} → ${events[events.length - 1].end}`);
if (empty.length > 0) console.log(`seasons with no rows: ${empty.join(", ")}`);
