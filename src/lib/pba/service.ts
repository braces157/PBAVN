/**
 * Composed reads. Pages should not talk to `api.ts` directly when the answer is
 * "the current season" or "what is on right now" — those questions have one
 * correct answer per request, and `cache()` keeps them to a single upstream hit.
 */

import { cache } from "react";
import {
  getLeagues,
  getPlayers,
  getRanking,
  getSeasonLeaders,
  getSeasons,
  getTeamLeagueRounds,
  getTeamLeagueSeasons,
  getTeamPlayerStats,
  getTeamStandings,
  getTournaments,
  getPlayerTourStats,
  type RankingKind,
} from "./api";
import { byStart, eventStatus, normalizeEvent, type Event } from "../normalize";
import { getPlayerSeasonMatches, searchNameOf, type TourMatch } from "./match-search";
import type { RawLeague, RawSeason } from "./types";

export const getSeasonList = cache(async (): Promise<RawSeason[]> => {
  const seasons = await getSeasons();
  return seasons.length > 0 ? seasons : [{ SeasonCode: "2026", SeasonTitle: "2026-2027" }];
});

export const getLeagueList = cache(async (): Promise<RawLeague[]> => {
  const leagues = await getLeagues();
  return leagues.length > 0 ? leagues : [];
});

/** Newest season first in the upstream feed, so `[0]` is the live one. */
export const getCurrentSeason = cache(async (): Promise<RawSeason> => {
  const seasons = await getSeasonList();
  return seasons[0];
});

export const getSeasonEvents = cache(async (season: string): Promise<Event[]> => {
  const tournaments = await getTournaments({ season });
  const events = tournaments.map(normalizeEvent).filter((e) => e.title !== "—");
  return events.sort(byStart);
});

export interface EventSnapshot {
  live: Event[];
  upcoming: Event[];
  completed: Event[];
  current: Event | null;
  next: Event | null;
}

export function snapshotEvents(events: Event[], now = new Date()): EventSnapshot {
  const live: Event[] = [];
  const upcoming: Event[] = [];
  const completed: Event[] = [];

  for (const event of events) {
    const status = eventStatus(event.start, event.end, now);
    if (status === "live") live.push(event);
    else if (status === "upcoming") upcoming.push(event);
    else completed.push(event);
  }

  upcoming.sort(byStart);
  completed.sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0));

  return {
    live,
    upcoming,
    completed,
    current: live[0] ?? upcoming[0] ?? completed[0] ?? null,
    next: upcoming[0] ?? null,
  };
}

export const getSeasonSnapshot = cache(async (season: string): Promise<EventSnapshot> => {
  return snapshotEvents(await getSeasonEvents(season));
});

/** The most recently finished team-league season, which is the one people care about. */
export const getActiveTeamSeason = cache(async () => {
  const seasons = await getTeamLeagueSeasons();
  const current = seasons[0] ?? null;
  if (!current) return null;
  const rounds = await getTeamLeagueRounds(current.리그코드);
  const liveRound =
    rounds.find((r) => r.진행상황 === "진행중") ??
    rounds.find((r) => r.포스트여부 === "N") ??
    rounds[0] ??
    null;
  return { season: current, rounds, liveRound };
});

export const getTeamBoard = cache(
  async (seasonCode: string, leagueCode: string, roundCode = "0") => {
    const [standings, players] = await Promise.all([
      getTeamStandings({ seasonCode, leagueCode, roundCode }),
      getTeamPlayerStats({ seasonCode, leagueCode, roundCode }),
    ]);
    return { standings, players };
  },
);

/* ---------------------------------------------------------- player history */

export interface PlayerMatchHistory {
  matches: TourMatch[];
  /** Tours the search actually queried this render. */
  toursSearched: number;
  toursFailed: number;
  /** True when a page or request cap bound the search with rows possibly missing. */
  partial: boolean;
  /** Null when the player has no searchable (Latin-script) English name. */
  searchTerm: string | null;
}

/**
 * Every recorded individual-tour match of one player in one season.
 *
 * The join runs through `getPlayerTourStats` — one row per tour entered — and
 * the search itself is one request per tour, paged and capped in
 * `./match-search`. Wrapped in `cache` so the metadata pass and the render
 * share a single fan-out.
 */
export const getPlayerMatchHistory = cache(async (params: {
  memCode: string;
  nameEn: string | null | undefined;
  nameEnShort: string | null | undefined;
  seasonCode: string;
  pbaType: string;
}): Promise<PlayerMatchHistory> => {
  const empty: PlayerMatchHistory = {
    matches: [],
    toursSearched: 0,
    toursFailed: 0,
    partial: false,
    searchTerm: null,
  };

  const searchTerm = searchNameOf(params.nameEn, params.nameEnShort);
  if (!searchTerm) return empty;

  const tours = await getPlayerTourStats({
    memCode: params.memCode,
    seasonCode: params.seasonCode,
    pbaType: params.pbaType,
  });
  if (tours.length === 0) return { ...empty, searchTerm };

  const result = await getPlayerSeasonMatches({
    memCode: params.memCode,
    searchName: searchTerm,
    tours: tours.map((tour) => ({
      code: String(tour.TourCode ?? ""),
      title: tour.TourTitleEn || tour.TourTitle || "",
    })),
  });

  return {
    matches: result.matches,
    toursSearched: result.searched,
    toursFailed: result.toursFailed,
    partial: result.partial,
    searchTerm,
  };
});

export const getRankingBoard = cache(
  async (params: { kind: RankingKind; leagueCode: string; season: string; tourCode?: string }) => {
    return getRanking(params);
  },
);

export const getLeaders = cache(async (season: string, pbaType: string) => {
  return getSeasonLeaders({ seasonCode: season, pbaType });
});

/* ------------------------------------------------------------------ labels */

export function seasonLabel(season: RawSeason | null | undefined): string {
  if (!season) return "—";
  return season.SeasonTitle || season.SeasonCode;
}

export function nextEventCountdown(event: Event | null): string {
  if (!event?.start) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(event.start);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((start.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return "Starts today";
  if (days === 1) return "Starts tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 30) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

/* ------------------------------------------------------- English resolution */

/**
 * The tour-history feed only carries Korean titles, and the team-league round
 * feed only carries Korean venues. Both have English equivalents elsewhere in
 * the API, so we join rather than translate:
 *
 *  - tournament schedule rows keyed by `MATCH_CODE` (== the tour code) hold `TITLE_EN`
 *  - the player directory maps Korean member names to their English spelling
 */

const VENUES: Record<string, string> = {
  "고양 킨텍스 PBA 스타디움": "Goyang Kintex PBA Stadium",
  "포항종합운동장 실내체육관": "Pohang Indoor Gymnasium",
  "화성종합경기타운 실내체육관": "Hwaseong Indoor Gymnasium",
  "광명시민체육관": "Gwangmyeong Citizens Gymnasium",
  "제주 한라체육관": "Jeju Halla Gymnasium",
  "고양체육관": "Goyang Gymnasium",
};

const SPONSORS: Record<string, string> = {
  웰컴저축은행: "Welcome Savings Bank",
  신한금융투자: "Shinhan Financial Investment",
  하나카드: "Hana Card",
  NH농협카드: "NH Nonghyup Card",
  우리금융캐피탈: "Woori Financial Capital",
  크라운해태: "Crown Haitai",
  휴온스: "Huons",
  하림: "Harim",
  제비스코: "JEVISCO",
  삼다수: "Jeju Samdasoo",
  블루원리조트: "Blueone Resort",
  고리나: "Gorina",
  "프로당구협회(PBA)": "Professional Billiards Association",
};

export function englishVenue(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "—";
  if (VENUES[raw]) return VENUES[raw];
  // Partial matches cover venues published with a suffix ("… 실내체육관 A").
  const partial = Object.keys(VENUES).find((key) => raw.includes(key));
  return partial ? VENUES[partial] : raw;
}

export function englishSponsor(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "—";
  const exact = SPONSORS[raw];
  if (exact) return exact;
  const partial = Object.keys(SPONSORS).find((key) => raw.includes(key));
  return partial ? SPONSORS[partial] : raw;
}

/** `2026-2027` + Korean league title → a stable English league name. */
export function teamLeagueTitle(seasonName: string): string {
  return `PBA Team League ${seasonName}`;
}

export interface TourTitleEntry {
  titleEn: string;
  titleKo: string;
  seq: string;
}

/**
 * Translation lookups ship as pre-built artefacts in `./data`.
 *
 * Building them from the live API meant a 783 KB player fetch that takes ~8 s on
 * a cold cache, on every page that renders a champion name. The data changes
 * only when a new season's roster is published, so it is snapshotted instead:
 * refresh with `npm run refresh-data`.
 */
import tourTitles from "./data/tour-titles.json";
import playerNames from "./data/player-names.json";

/** Tour code → English title. */
export function getTourTitleIndex(): Map<string, TourTitleEntry> {
  const index = new Map<string, TourTitleEntry>();
  for (const [key, title] of Object.entries(tourTitles as Record<string, string>)) {
    if (title) index.set(key, { titleEn: title, titleKo: title, seq: key });
  }
  return index;
}

/** Korean member name → English member name, for the champion columns. */
export function getPlayerNameIndex(): Map<string, string> {
  return new Map(Object.entries(playerNames as Record<string, string>));
}

/**
 * The winner field uses a display abbreviation ("Q.응우옌") that never matches the
 * directory's full Korean name, so a miss falls back to a suffix lookup.
 */
const KoreanInitialPattern = /^[A-Za-z가-힣]\.\s*/;

export function resolveKoreanName(champion: string, index: Map<string, string>): string {
  const raw = champion.trim();
  if (!raw) return champion;
  const exact = index.get(raw);
  if (exact) return exact;

  const withoutInitial = raw.replace(KoreanInitialPattern, "").trim();
  if (withoutInitial && withoutInitial !== raw) {
    const direct = index.get(withoutInitial);
    if (direct) return direct;
  }

  const needle = withoutInitial || raw;
  for (const [ko, en] of index) {
    if (ko.endsWith(needle)) return en;
  }
  return champion;
}

/** Resolve a tour row's Korean title and champion into English where possible. */
export function resolveTourLabels(rows: {
  title: string;
  champion: string;
  code: string | number;
}[]): { title: string; champion: string }[] {
  const titles = getTourTitleIndex();
  const names = getPlayerNameIndex();
  return rows.map((row) => {
    const entry = titles.get(String(row.code));
    return {
      title: entry?.titleEn || row.title,
      champion: resolveKoreanName(row.champion, names),
    };
  });
}
