// Rebuilds the translation artefacts in src/lib/pba/data from the live API.
//
// These maps change only when a new season's roster is published, so they are
// committed rather than fetched per request. Run with `npm run refresh-data`.

import { writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "src", "lib", "pba", "data");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "X-Requested-With": "XMLHttpRequest",
  Referer: "https://www.pbatour.org/en/index",
};

// The upstream omits its intermediate certificate; see src/lib/pba/http.ts.
function get(url) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = httpsRequest(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        headers: { ...HEADERS, "Accept-Encoding": "identity" },
        rejectUnauthorized: false,
        timeout: 120_000,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    request.on("error", reject);
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.end();
  });
}

const playersRaw = await get(
  "https://www.pbatour.org/en/player/search/ajax/indexList?curPage=1&pageRowSize=2000&leagueCode=PBA1",
);
const players = JSON.parse(playersRaw);
const playerNames = {};
for (const player of players.list ?? []) {
  if (player.PlayerNameKO && player.PlayerNameEN) {
    playerNames[player.PlayerNameKO.trim()] = player.PlayerNameEN.trim();
  }
}

const toursRaw = await get("https://www.pbatour.org/en/tournament/schedule/ajax/list");
const tours = JSON.parse(toursRaw);
const tourTitles = {};
for (const tour of tours.list ?? []) {
  const key = String(tour.MATCH_CODE || tour.SEQ || "");
  if (key && tour.TITLE_EN) tourTitles[key] = tour.TITLE_EN;
}

await writeFile(join(OUT, "player-names.json"), JSON.stringify(playerNames));
await writeFile(join(OUT, "tour-titles.json"), JSON.stringify(tourTitles));

console.log(`player-names.json  ${Object.keys(playerNames).length} entries`);
console.log(`tour-titles.json   ${Object.keys(tourTitles).length} entries`);
