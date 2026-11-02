/**
 * One function per upstream endpoint. Everything returns plain arrays / objects
 * with `null` for "the feed did not answer", so callers can render an honest
 * empty state instead of blowing up.
 */

import { fetchJson, qs, type PbaEnvelope } from "./http";
import type {
  RawAward,
  RawChampion,
  RawGallery,
  RawHeadToHead,
  RawHomeInfo,
  RawLeague,
  RawPlayer,
  RawPlayerStat,
  RawPeriodStat,
  RawPress,
  RawRankTour,
  RawRankingRow,
  RawSeason,
  RawSeasonRank,
  RawTeamInfo,
  RawTeamMatch,
  RawTeamPlayerStat,
  RawTeamRound,
  RawTeamSeason,
  RawTeamStat,
  RawTop5Row,
  RawTotalRank,
  RawTour,
  RawTournament,
  RawTournamentDetail,
  RawVideo,
} from "./types";

/* --------------------------------------------------------------- primitives */

const CACHE = {
  /** Leagues and seasons change once a year. */
  static: 86_400,
  /** Rankings and stats settle over hours. */
  stats: 900,
  /** Schedules change rarely but matter when they do. */
  schedule: 1_800,
  /** Player directory is large and slow-moving. */
  directory: 3_600,
  /** Editorial content. */
  editorial: 900,
  /** Live-ish data. */
  live: 30,
} as const;

function rows<T>(envelope: PbaEnvelope<T> | null): T[] {
  if (!envelope) return [];
  if (Array.isArray(envelope.list)) return envelope.list;
  if (envelope.result && Array.isArray(envelope.result.list)) return envelope.result.list;
  return [];
}

/**
 * Wraps a page body so transport failures are recorded for that render only.
 * Pages call this around their data reads, and `DataStatus` reads the result.
 */
export { trackFailures } from "./failures";

/* ------------------------------------------------------------------ leagues */

export async function getLeagues(): Promise<RawLeague[]> {
  const data = await fetchJson<PbaEnvelope<RawLeague>>("/ajax/leagueInfoList", {
    revalidate: CACHE.static,
  });
  return rows(data);
}

export async function getSeasons(): Promise<RawSeason[]> {
  const data = await fetchJson<PbaEnvelope<RawSeason>>("/tournament/schedule/ajax/season", {
    revalidate: CACHE.static,
  });
  return rows(data);
}

/* -------------------------------------------------------------- tournaments */

export async function getTournaments(params: {
  season?: string;
  leagueCode?: string;
  topOnly?: boolean;
} = {}): Promise<RawTournament[]> {
  const { season, leagueCode, topOnly } = params;
  const query = qs({ langCode: "ko", leagueCode, season, top_yn: topOnly ? 1 : undefined });
  const data = await fetchJson<PbaEnvelope<RawTournament>>(`/tournament/schedule/ajax/list${query}`, {
    revalidate: CACHE.schedule,
    timeoutMs: 20_000,
  });
  return rows(data);
}

export async function getTournamentDetail(seq: string): Promise<RawTournamentDetail | null> {
  const data = await fetchJson<PbaEnvelope<RawTournamentDetail>>(
    `/tournament/schedule/ajax/detail${qs({ seq })}`,
    { revalidate: CACHE.schedule },
  );
  return data?.data ?? null;
}

/* ------------------------------------------------------------------ players */

export interface PlayerQuery {
  page?: number;
  pageSize?: number;
  leagueCode?: string;
  initial?: string;
  name?: string;
}

export async function getPlayers(query: PlayerQuery = {}): Promise<{
  list: RawPlayer[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const { page = 1, pageSize = 24, leagueCode, initial, name } = query;
  const data = await fetchJson<PbaEnvelope<RawPlayer>>(
    `/player/search/ajax/indexList${qs({
      curPage: page,
      pageRowSize: pageSize,
      leagueCode,
      initialCharacter: initial,
      playerNameStr: name,
    })}`,
    { revalidate: CACHE.directory, timeoutMs: 20_000 },
  );
  return {
    list: rows(data),
    total: data?.page?.totcnt ?? 0,
    page,
    pageSize,
  };
}

export async function getPlayer(memCode: string): Promise<RawPlayer | null> {
  if (!memCode) return null;
  const data = await fetchJson<PbaEnvelope<RawPlayer>>(
    `/player/search/ajax/detail${qs({ memCode })}`,
    { revalidate: CACHE.stats },
  );
  return data?.data ?? null;
}

/* ----------------------------------------------------------------- rankings */

export type RankingKind = "prize" | "point" | "welcome";

const RANKING_PATHS: Record<RankingKind, string> = {
  prize: "/stats/ranking_prize/ajax/list",
  point: "/stats/ranking_point/ajax/list",
  welcome: "/stats/welcome_top_ranking/ajax/list",
};

function rankingParams(leagueCode: string, season: string, tourCode: string) {
  const isLpba = leagueCode.startsWith("LPBA");
  return {
    leagueCode,
    season,
    seasonCode: season,
    tourCode,
    pbaType: isLpba ? "LPBA" : "PBA",
    league: leagueCode.slice(-1),
  };
}

export async function getRanking(params: {
  kind?: RankingKind;
  leagueCode: string;
  season: string;
  tourCode?: string;
}): Promise<RawRankingRow[]> {
  const { kind = "prize", leagueCode, season, tourCode = "0" } = params;
  const data = await fetchJson<PbaEnvelope<RawRankingRow>>(
    `${RANKING_PATHS[kind]}${qs(rankingParams(leagueCode, season, tourCode))}`,
    { revalidate: CACHE.stats },
  );
  return rows(data);
}

export async function getRankingTours(params: {
  leagueCode: string;
  season: string;
}): Promise<RawRankTour[]> {
  const data = await fetchJson<PbaEnvelope<RawRankTour>>(
    `/stats/ranking_prize/ajax/tourList${qs(rankingParams(params.leagueCode, params.season, "0"))}`,
    { revalidate: CACHE.stats },
  );
  return rows(data);
}

/* -------------------------------------------------------- player statistics */

export async function getPlayerSeasonStats(params: {
  memCode: string;
  seasonCode: string;
  pbaType: string;
}): Promise<RawPlayerStat | null> {
  const data = await fetchJson<PbaEnvelope<RawPlayerStat>>(
    `/stats/service/season${qs({
      seasonCode: params.seasonCode,
      tourCode: 0,
      memCode: params.memCode,
      pbaType: params.pbaType,
    })}`,
    { revalidate: CACHE.stats },
  );
  return rows(data)[0] ?? null;
}

export async function getPlayerTourStats(params: {
  memCode: string;
  seasonCode: string;
  pbaType: string;
}): Promise<RawPlayerStat[]> {
  const data = await fetchJson<PbaEnvelope<RawPlayerStat>>(
    `/stats/service/tour${qs(params)}`,
    { revalidate: CACHE.stats },
  );
  return rows(data);
}

export async function getPlayerChampionships(memCode: string): Promise<RawChampion[]> {
  const data = await fetchJson<PbaEnvelope<RawChampion>>(
    `/stats/service/champion${qs({ memCode })}`,
    { revalidate: CACHE.stats },
  );
  return rows(data);
}

export async function getPlayerSeasonRank(params: {
  memCode: string;
  seasonCode: string;
  pbaType: string;
}): Promise<RawSeasonRank | null> {
  const data = await fetchJson<PbaEnvelope<RawSeasonRank>>(
    `/stats/service/rank${qs(params)}`,
    { revalidate: CACHE.stats },
  );
  return rows(data)[0] ?? null;
}

export async function getPlayerCareerRank(memCode: string): Promise<RawTotalRank | null> {
  const data = await fetchJson<PbaEnvelope<RawTotalRank>>(
    `/stats/service/rank/total${qs({ memCode })}`,
    { revalidate: CACHE.stats },
  );
  return rows(data)[0] ?? null;
}

/* ----------------------------------------------------------------- records */

export async function getSeasonLeaders(params: {
  seasonCode: string;
  pbaType: string;
}): Promise<RawTop5Row[]> {
  const data = await fetchJson<PbaEnvelope<RawTop5Row>>(
    `/stats/service/top5/season${qs(params)}`,
    { revalidate: CACHE.stats },
  );
  return rows(data);
}

/**
 * The full per-player statistical record for a date window.
 *
 * `pbaType` takes the circuit code (`PBA1`, `LPBA1`, `PBA2`), not the display
 * name. `orderBy` is a Korean column alias and the service rejects the request
 * outright when it is empty, so it is always supplied even though callers rank
 * the rows themselves.
 */
export async function getPeriodStats(params: {
  startDate: string;
  endDate: string;
  pbaType: string;
  orderBy?: string;
  sort?: "asc" | "desc";
}): Promise<RawPeriodStat[]> {
  const data = await fetchJson<PbaEnvelope<RawPeriodStat>>(
    `/stats/service/period${qs({
      startDate: params.startDate,
      endDate: params.endDate,
      pbaType: params.pbaType,
      orderBy: params.orderBy ?? "승수",
      sort: params.sort ?? "desc",
      langCode: "en",
    })}`,
    { revalidate: CACHE.stats, timeoutMs: 25_000 },
  );
  return rows(data);
}

export async function getTourHistory(): Promise<RawTour[]> {
  const data = await fetchJson<PbaEnvelope<RawTour>>("/service/ajax/tour/getTourList", {
    revalidate: CACHE.stats,
    timeoutMs: 20_000,
  });
  return rows(data);
}

/* ------------------------------------------------------------ head to head */

export async function getHeadToHead(params: {
  memberCode1: string;
  memberCode2: string;
  seasonCode: string;
  pbaType: string;
}): Promise<RawHeadToHead | null> {
  const { memberCode1, memberCode2, seasonCode, pbaType } = params;
  if (!memberCode1 || !memberCode2) return null;
  const data = await fetchJson<{ result?: { data?: RawHeadToHead[] } }>(
    `/stats/service/headtohead${qs({ seasonCode, memberCode1, memberCode2, pbaType })}`,
    { revalidate: CACHE.stats },
  );
  return data?.result?.data?.[0] ?? null;
}

/* -------------------------------------------------------------- team league */

export async function getTeamLeagueSeasons(): Promise<RawTeamSeason[]> {
  const data = await fetchJson<PbaEnvelope<RawTeamSeason>>("/teamLeague/ajax/season", {
    revalidate: CACHE.static,
  });
  return rows(data);
}

export async function getTeamLeagueRounds(leagueCode: string | number): Promise<RawTeamRound[]> {
  const data = await fetchJson<PbaEnvelope<RawTeamRound>>("/teamLeague/ajax/gameList", {
    method: "POST",
    body: `langCode=ko&LeagueCode=${encodeURIComponent(String(leagueCode))}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    revalidate: CACHE.schedule,
  });
  return rows(data);
}

function teamParams(seasonCode: string, leagueCode: string, roundCode: string, extra: Record<string, string> = {}) {
  return {
    seasonCode1: seasonCode,
    leagueCode1: leagueCode,
    roundCode1: roundCode,
    langCode: "en",
    ...extra,
  };
}

export async function getTeamStandings(params: {
  seasonCode: string;
  leagueCode: string;
  roundCode?: string;
  orderBy?: string;
  orderDirection?: string;
}): Promise<RawTeamStat[]> {
  const { seasonCode, leagueCode, roundCode = "0", orderBy = "", orderDirection = "" } = params;
  const data = await fetchJson<PbaEnvelope<RawTeamStat>>(
    `/teamLeague/stats/ajax/seasonTeam${qs(teamParams(seasonCode, leagueCode, roundCode, { orderBy, orderDirection }))}`,
    { revalidate: CACHE.stats },
  );
  return rows(data);
}

export async function getTeamPlayerStats(params: {
  seasonCode: string;
  leagueCode: string;
  roundCode?: string;
  orderBy?: string;
  orderDirection?: string;
}): Promise<RawTeamPlayerStat[]> {
  const { seasonCode, leagueCode, roundCode = "0", orderBy = "", orderDirection = "" } = params;
  const data = await fetchJson<PbaEnvelope<RawTeamPlayerStat>>(
    `/teamLeague/stats/ajax/seasonPlayer${qs(teamParams(seasonCode, leagueCode, roundCode, { orderBy, orderDirection }))}`,
    { revalidate: CACHE.stats },
  );
  return rows(data);
}

export async function getTeamRoster(params: {
  seasonCode: string;
  leagueCode: string;
  roundCode?: string;
}): Promise<RawTeamInfo[]> {
  const data = await fetchJson<PbaEnvelope<RawTeamInfo>>(
    `/teamLeague/stats/ajax/getTeamListBySeasonRound${qs(teamParams(params.seasonCode, params.leagueCode, params.roundCode ?? "0"))}`,
    { revalidate: CACHE.stats },
  );
  return rows(data);
}

export async function getTeamMatchMatrix(params: {
  seasonCode: string;
  leagueCode: string;
  roundCode?: string;
}): Promise<RawTeamMatch[]> {
  const data = await fetchJson<PbaEnvelope<RawTeamMatch>>(
    `/teamLeague/stats/ajax/getTeamWinLoseByTeam${qs(teamParams(params.seasonCode, params.leagueCode, params.roundCode ?? "0"))}`,
    { revalidate: CACHE.stats },
  );
  return rows(data);
}

/* ------------------------------------------------------------------- media */

export async function getPressList(page = 1, pageSize = 12): Promise<{
  list: RawPress[];
  total: number;
}> {
  const data = await fetchJson<PbaEnvelope<RawPress>>(
    `/media/press/ajax/list${qs({ curPage: page, pageRowSize: pageSize })}`,
    { revalidate: CACHE.editorial },
  );
  return { list: rows(data), total: data?.page?.totcnt ?? 0 };
}

export async function getPressDetail(seq: string): Promise<RawPress | null> {
  if (!seq) return null;
  const data = await fetchJson<PbaEnvelope<RawPress>>(
    `/media/press/ajax/detail${qs({ seq })}`,
    { revalidate: CACHE.editorial },
  );
  return data?.data ?? rows(data)[0] ?? null;
}

export async function getVideos(page = 1, pageSize = 12): Promise<RawVideo[]> {
  const data = await fetchJson<PbaEnvelope<RawVideo>>(
    `/media/video/ajax/list${qs({ curPage: page, pageRowSize: pageSize })}`,
    { revalidate: CACHE.editorial },
  );
  return rows(data);
}

export async function getGalleries(page = 1, pageSize = 12): Promise<RawGallery[]> {
  const data = await fetchJson<PbaEnvelope<RawGallery>>(
    `/media/gallery/ajax/list${qs({ curPage: page, pageRowSize: pageSize })}`,
    { revalidate: CACHE.editorial },
  );
  return rows(data);
}

/* ------------------------------------------------------------------ awards */

export async function getAwards(params: {
  category: string;
  season: string;
}): Promise<RawAward[]> {
  const data = await fetchJson<PbaEnvelope<RawAward>>(
    `/award/ajax/tour${qs({ category: params.category, season: params.season })}`,
    { revalidate: CACHE.editorial },
  );
  return rows(data);
}

/* -------------------------------------------------------------------- home */

export async function getHomeInfo(seasonCode: string): Promise<RawHomeInfo | null> {
  const data = await fetchJson<PbaEnvelope<RawHomeInfo>>(
    `/ajax/info${qs({ seasonCode })}`,
    { revalidate: CACHE.stats, timeoutMs: 25_000 },
  );
  return data?.data ?? null;
}
