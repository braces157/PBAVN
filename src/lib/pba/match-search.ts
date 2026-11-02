/**
 * Player match history: one name search per tour the player entered.
 *
 * The scoring terminal's only per-player view is a name search inside one
 * tour, so a season is answered by fanning out over the tours that
 * `getPlayerTourStats` reports. The search matches name fragments — "Cho"
 * returns every Cho — so a row belongs to the player only when its
 * `matchlayer` MemCodes say so, never because the name string looked right.
 *
 * Every request is bounded: pages per tour, searches per render, and a small
 * pool of concurrent calls. A tour whose last page was still full when a cap
 * bound is reported as truncated, because rows were plausibly dropped and the
 * page has to say so rather than render a confident, shorter table.
 */

import { fetchHtmlFragment } from "./http";
import { parseSearchRows, type SearchedMatch } from "./search-parse";

export type { HistorySide, SearchedMatch } from "./search-parse";
export { parseSearchRows } from "./search-parse";

/** A bracket page holds twenty rows. */
const PAGE_SIZE = 20;
/** How far to page within one tour before giving up on a partial season. */
const PAGES_PER_TOUR = 3;
/** Search requests one render may issue, across all tours. */
const MAX_SEARCHES = 18;
/** Tours one season spans, in the worst degenerate case. */
const MAX_TOURS = 14;
/** Concurrent searches. In the spirit of the bracket fan-out, never a storm. */
const SEARCH_POOL = 6;

/** A search response goes stale slower than a live board but faster than a season. */
const REVALIDATE = 1800;

export interface TourMatch extends SearchedMatch {
  tourCode: string;
  tourTitle: string;
}

export interface SeasonMatchQuery {
  memCode: string;
  /** The player's English name. Latin script only; the terminal answers Korean terms with 0 bytes. */
  searchName: string;
  /** One entry per tour the player entered this season, from getPlayerTourStats. */
  tours: { code: string; title: string }[];
}

export interface SeasonMatchResult {
  matches: TourMatch[];
  /** Tours actually queried, for the partial-data notice. */
  searched: number;
  toursFailed: number;
  /** True when a page or request cap bound the search with rows possibly missing. */
  partial: boolean;
}

/**
 * The search term, if there is one that can work.
 *
 * The terminal matches Latin fragments of the name it publishes itself — the
 * directory's `PlayerNameENShort` ("KH Cho"), not its full display name
 * ("Keon-hwi CHO"), is the form the terminal knows. The surname fragment is
 * therefore the term: it is the one string that reliably hits, and the
 * collisions a fragment invites are exactly what the MemCode filter and the
 * page caps exist for. A Korean name is never a fallback — with `LangCode=en`
 * it verifiably answers 0 bytes, which would read as a player with no matches.
 */
export function searchNameOf(
  nameEn: string | null | undefined,
  nameEnShort: string | null | undefined,
): string | null {
  for (const candidate of [nameEnShort, nameEn]) {
    const words = (candidate ?? "").trim().split(/\s+/).filter(Boolean);
    const term = words[words.length - 1] ?? "";
    if (!term || !/^[\x20-\x7E]+$/.test(term)) continue;
    return term;
  }
  return null;
}

/** Run `fn` over `items` with at most `limit` promises in flight, preserving order. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

interface TourSearch {
  rows: SearchedMatch[];
  searched: boolean;
  failed: boolean;
  truncated: boolean;
}

async function searchTour(
  query: SeasonMatchQuery,
  tour: { code: string; title: string },
  state: { issued: number },
): Promise<TourSearch> {
  const rows: SearchedMatch[] = [];
  let searched = false;
  let failed = false;
  let truncated = false;
  let fullPage = false;

  for (let page = 1; page <= PAGES_PER_TOUR; page += 1) {
    if (state.issued >= MAX_SEARCHES) {
      // The render's request budget ran out: either this tour was never
      // queried, or its last page was full and the next one is missing.
      if (!searched || fullPage) truncated = true;
      break;
    }

    // Reserve the slot before the await, so concurrent workers cannot slip
    // past the cap between the check and the reservation.
    state.issued += 1;
    const html = await fetchHtmlFragment(
      `/mob/contest_new/code_behind/contest_result_sur.asp?TourCode=${encodeURIComponent(tour.code)}&iBLCode=128&iPage=${page}&txt_Search=${encodeURIComponent(query.searchName)}&LangCode=en`,
      // A tour the player did not enter answers with a 0-byte body — a real
      // "no rows", not a failure. The flag keeps the failure log honest.
      { revalidate: REVALIDATE, timeoutMs: 12_000, allowEmpty: true },
    );
    searched = true;

    if (html === null) {
      failed = true;
      break;
    }

    const parsed = parseSearchRows(html);
    rows.push(...parsed);

    if (parsed.length < PAGE_SIZE) break;
    fullPage = true;
    if (page === PAGES_PER_TOUR) truncated = true;
  }

  return { rows, searched, failed, truncated };
}

export async function getPlayerSeasonMatches(query: SeasonMatchQuery): Promise<SeasonMatchResult> {
  const tours = query.tours.slice(0, MAX_TOURS);
  const state = { issued: 0 };

  const results = await mapPool(tours, SEARCH_POOL, (tour) => searchTour(query, tour, state));

  // Membership is decided on codes: a fragment search returns every Cho, and
  // only the rows whose matchlayer codes include this player are theirs.
  const matches = results.flatMap((result, index) =>
    result.rows
      .filter((row) => row.sides.some((side) => side.memCode === query.memCode))
      .map((row) => ({
        ...row,
        tourCode: tours[index].code,
        tourTitle: tours[index].title,
      })),
  );

  return {
    matches,
    searched: results.filter((result) => result.searched).length,
    toursFailed: results.filter((result) => result.failed).length,
    partial: results.some((result) => result.truncated),
  };
}
