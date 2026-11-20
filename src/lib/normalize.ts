/**
 * Upstream → domain. Every screen consumes these shapes, so this is the one
 * place that knows about `_EN` suffixes, Korean column aliases and the
 * placeholder strings the legacy CMS emits for "not decided yet".
 */

import { asset, isRealAsset } from "./pba/http";
import { eventArtUrl } from "./event-art";
import { playerPhotoPath } from "./photo";
import {
  cleanDisplayText,
  cleanPlayerName,
  hasHangul,
  int,
  isoDay,
  kstDay,
  num,
  pick,
  isPlaceholder,
  romanizeKoreanName,
  safeHttpUrl,
  stripTags,
  toDate,
} from "./format";
import type {
  RawPlayer,
  RawPlayerStat,
  RawPress,
  RawTeamInfo,
  RawTeamMatch,
  RawTeamPlayerStat,
  RawTeamStat,
  RawTournament,
} from "./pba/types";

/* ------------------------------------------------------------------ leagues */

export interface League {
  code: string;
  name: string;
  /** The 2-4 letter circuit mark on scoreboard gutters and crest fallbacks. */
  tag: string;
  tagline: string;
  /** Tailwind-friendly accent token used for chips and rails. */
  tone: "lime" | "rose" | "cyan" | "amber" | "violet";
}

export const LEAGUES: League[] = [
  { code: "PBA1", name: "PBA Tour", tag: "PBA", tagline: "The top men's professional tour", tone: "lime" },
  { code: "LPBA1", name: "LPBA Tour", tag: "LPBA", tagline: "The women's professional tour", tone: "rose" },
  { code: "PBA2", name: "Dream Tour", tag: "DRM", tagline: "Development tier", tone: "cyan" },
  { code: "PBA3", name: "Challenge Tour", tag: "CHL", tagline: "Entry tier", tone: "amber" },
  { code: "TLG", name: "Team League", tag: "TLG", tagline: "Franchise team competition", tone: "violet" },
];

export function leagueByCode(code: string | null | undefined): League {
  return (
    LEAGUES.find((l) => l.code === code) ?? {
      code: code ?? "",
      name: code ?? "—",
      tag: code ?? "—",
      tagline: "",
      tone: "lime",
    }
  );
}

/** The circuit mark for a league code ("LPBA1" → "LPBA"), or the code itself. */
export function leagueShort(code: string | null | undefined): string {
  if (!code) return "—";
  return leagueByCode(code).tag || code;
}

export function leagueName(code: string | null | undefined): string {
  return leagueByCode(code).name;
}

/** `TLG` is not a player league; filter it out of player-facing selectors. */
export const PLAYER_LEAGUES = LEAGUES.filter((l) => l.code !== "TLG");

/** Sponsor-recommended members are scored against the top-tier table. */
export function statLeagueCode(code: string): string {
  if (code === "PBA9") return "PBA1";
  if (code === "LPBA9") return "LPBA1";
  return code;
}

/* -------------------------------------------------------------- tournaments */

export type EventStatus = "live" | "upcoming" | "completed";

export interface Event {
  id: string;
  title: string;
  league: string;
  season: string;
  start: Date | null;
  end: Date | null;
  venue: string;
  sponsor: string;
  prizePool: string;
  championPrize: string;
  broadcast: string;
  defendingChampion: string;
  table: string;
  ball: string;
  cloth: string;
  entrants: { players: number | null; teams: number | null };
  logo: string | null;
  hasDetail: boolean;
  guideUrl: string | null;
  status: EventStatus;
  raw: RawTournament;
}

export function eventStatus(start: Date | null, end: Date | null, now = new Date()): EventStatus {
  const today = kstDay(now);
  const s = isoDay(start);
  const e = isoDay(end);
  if (s && e) {
    if (today >= s && today <= e) return "live";
    if (today < s) return "upcoming";
    return "completed";
  }
  if (s) return s < today ? "completed" : "upcoming";
  return "upcoming";
}

function pickCleanPlayerName(en?: string | null, ko?: string | null): string {
  const ce = cleanPlayerName(en);
  if (ce && ce !== "—" && !isPlaceholder(ce)) return ce;
  const ck = cleanPlayerName(ko);
  return ck && ck !== "—" && !isPlaceholder(ck) ? ck : "";
}

export function normalizeEvent(raw: RawTournament): Event {
  const start = toDate(raw.MATCH_START_DATE);
  const end = toDate(raw.MATCH_END_DATE);
  const rawChamp = pickCleanPlayerName(raw.PREV_WINNER_NAME_EN, raw.PREV_WINNER_NAME) || "—";
  return {
    id: raw.SEQ,
    title: cleanDisplayText(pick(raw.TITLE_EN, raw.TITLE)) || "—",
    league: raw.LEAGUE_GUBUN,
    season: raw.SEASON_GUBUN,
    start,
    end,
    venue: cleanDisplayText(pick(raw.PLACE_EN, raw.PLACE)) || "—",
    sponsor: cleanDisplayText(pick(raw.SPONSOR_EN, raw.SPONSOR)) || "—",
    prizePool: cleanDisplayText(pick(raw.TOTAL_PRIZE_EN, raw.TOTAL_PRIZE)) || "—",
    championPrize: cleanDisplayText(pick(raw.WINNING_PRIZE_EN, raw.WINNING_PRIZE)) || "—",
    broadcast: cleanDisplayText(pick(raw.BROADCAST_EN, raw.BROADCAST)) || "—",
    defendingChampion: rawChamp === "—" ? "—" : hasHangul(rawChamp) ? romanizeKoreanName(rawChamp) : rawChamp,
    table: cleanDisplayText(pick(raw.TABLE_MODEL, raw.TABLE_MODEL)) || "—",
    ball: cleanDisplayText(pick(raw.BALL_MODEL, raw.BALL_MODEL)) || "—",
    cloth: cleanDisplayText(pick(raw.CLOTH_MODEL, raw.CLOTH_MODEL)) || "—",
    entrants: {
      players: isPlaceholder(raw.JOIN_PLAYER) ? null : int(raw.JOIN_PLAYER),
      teams: isPlaceholder(raw.JOIN_TEAM) ? null : int(raw.JOIN_TEAM),
    },
    logo: isRealAsset(raw.SPONSOR_LOGO_FILE_PATH) ? asset(raw.SPONSOR_LOGO_FILE_PATH) : null,
    hasDetail: raw.DETAIL_BTN_ACTIVE_YN === 1,
    guideUrl: safeHttpUrl(raw.TOURNAMENT_GUIDE_URL_EN || raw.TOURNAMENT_GUIDE_URL),
    status: eventStatus(start, end),
    raw,
  };
}

/** Chronological sort with undated events pushed to the end. */
export function byStart(a: Event, b: Event): number {
  const at = a.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bt = b.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return at - bt;
}

/* ------------------------------------------------------------------ players */

export interface Player {
  code: string;
  name: string;
  nameKo: string;
  shortName: string;
  nation: string;
  gender: string;
  birth: string | null;
  league: string;
  photo: string | null;
  photoLarge: string | null;
  /** Raw upstream path, for `/api/photo`. Photos render from the big copy, not this one. */
  photoPath: string | null;
  average: number;
  highRun: number;
  bankShotRate: number;
  wins: number;
  losses: number;
  draws: number;
  prize: number;
  prizeRank: number;
  points: number;
  pointsRank: number;
}

export function normalizePlayer(raw: RawPlayer): Player {
  const pickedName = pickCleanPlayerName(raw.PlayerNameEN, raw.PlayerNameKO);
  const pickedShort = pickCleanPlayerName(raw.PlayerNameENShort, raw.PlayerNameKOShort);
  return {
    code: raw.MemCode,
    name: hasHangul(pickedName) ? romanizeKoreanName(pickedName) : pickedName || "—",
    nameKo: raw.PlayerNameKO,
    shortName: hasHangul(pickedShort) ? romanizeKoreanName(pickedShort) : pickedShort || "—",
    nation: raw.NationCode || "—",
    gender: raw.Gender === "F" ? "F" : "M",
    birth: raw.BirthDay ? String(raw.BirthDay).slice(0, 10) : null,
    league: raw.LeagueCode,
    photo: isRealAsset(raw.ImgURL) ? asset(raw.ImgURL) : null,
    photoLarge: isRealAsset(raw.ImgURLBig) ? asset(raw.ImgURLBig) : null,
    photoPath: playerPhotoPath(raw.ImgURLBig) ?? playerPhotoPath(raw.ImgURL),
    average: num(raw.Average),
    highRun: int(raw.HR),
    bankShotRate: num(raw.BankShotRate),
    wins: int(raw.Win),
    losses: int(raw.Lose),
    draws: int(raw.Draw),
    prize: num(raw.Prize),
    prizeRank: int(raw.PrizeRank),
    points: num(raw.RankingPoint),
    pointsRank: int(raw.RankingPointRank),
  };
}

export function winRate(p: { wins: number; losses: number; draws?: number }): number {
  const total = p.wins + p.losses + (p.draws ?? 0);
  if (!total) return 0;
  return (p.wins / total) * 100;
}

/* ---------------------------------------------------------- player statistics */

export interface PlayerStatLine {
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  setWins: number;
  setLosses: number;
  innings: number;
  points: number;
  average: number;
  highRun: number;
  onePoint: number;
  twoPoint: number;
  bankShots: number;
  bankShotRate: number;
  longRunCount: number;
  longRunRate: number;
  firstShotRate: number;
  attackMade: number;
  attackTried: number;
  attackRate: number;
  shootoutRate: number;
  ranks: {
    average: number;
    highRun: number;
    winRate: number;
    bankShotRate: number;
    longRunRate: number;
    firstShotRate: number;
    attackRate: number;
    points: number;
    prize: number;
    rankingPoints: number;
    shootoutRate: number;
  };
}

const EMPTY_STAT: PlayerStatLine = {
  matches: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  setWins: 0,
  setLosses: 0,
  innings: 0,
  points: 0,
  average: 0,
  highRun: 0,
  onePoint: 0,
  twoPoint: 0,
  bankShots: 0,
  bankShotRate: 0,
  longRunCount: 0,
  longRunRate: 0,
  firstShotRate: 0,
  attackMade: 0,
  attackTried: 0,
  attackRate: 0,
  shootoutRate: 0,
  ranks: {
    average: 0,
    highRun: 0,
    winRate: 0,
    bankShotRate: 0,
    longRunRate: 0,
    firstShotRate: 0,
    attackRate: 0,
    points: 0,
    prize: 0,
    rankingPoints: 0,
    shootoutRate: 0,
  },
};

export function normalizePlayerStat(raw: RawPlayerStat | null | undefined): PlayerStatLine {
  if (!raw) return EMPTY_STAT;
  return {
    matches: int(raw.경기수),
    wins: int(raw.승리수),
    losses: int(raw.패배수),
    winRate: num(raw.승률),
    setWins: int(raw.세트승리수),
    setLosses: int(raw.세트패배수),
    innings: int(raw.이닝수),
    points: int(raw.점수),
    average: num(raw.에버리지),
    highRun: int(raw.하이런),
    onePoint: int(raw.원포인트),
    twoPoint: int(raw.투포인트),
    bankShots: int(raw.뱅크샷),
    bankShotRate: num(raw.뱅크샷비율),
    longRunCount: int(raw.장타수),
    longRunRate: num(raw.장타율),
    firstShotRate: num(raw.초구성공률),
    attackMade: int(raw.공격성공수),
    attackTried: int(raw.공격시도수),
    attackRate: num(raw.공격성공률),
    shootoutRate: num(raw.승부치기승률),
    ranks: {
      average: int(raw.에버리지순위),
      highRun: int(raw.하이런순위),
      // The service answers 1 for 승률순위 and 승부치기승률순위 for every player
      // (verified Nov 2026 from 0% to 89% win rates), so both are dropped rather
      // than shown as a circuit lead nobody holds. 0 renders as "no rank".
      winRate: 0,
      bankShotRate: int(raw.뱅크샷비율순위),
      longRunRate: int(raw.장타율순위),
      firstShotRate: int(raw.초구성공률순위),
      attackRate: int(raw.공격성공률순위),
      points: int(raw.총점순위),
      prize: int(raw.상금순위),
      rankingPoints: int(raw.랭킹포인트순위),
      shootoutRate: 0,
    },
  };
}

export function hasStatData(line: PlayerStatLine): boolean {
  return line.matches > 0 || line.wins > 0 || line.innings > 0;
}

/* -------------------------------------------------------------- team league */

export interface TeamStanding {
  code: string;
  name: string;
  shortName: string;
  rank: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  setWins: number;
  setLosses: number;
  setRatio: number;
  pointsFor: number;
  pointsAgainst: number;
  pointRatio: number;
  matches: number;
  average: number;
  highRun: number;
  logo: string | null;
  raw: RawTeamStat;
}

const CLUB_NAMES_EN: Record<string, string> = {
  T00001: "Shinhan ALPHAS",
  T00002: "Welcome Savings Bank WELCOME PHOENIX",
  T00003: "CROWN HAITAI LAON",
  T00004: "TS Shampoo PURADAK HEROES",
  T00005: "BlueOne ANGELS",
  T00006: "SK rent-a-car DIRECT",
  T00008: "NH Nonghyup Card GREEN FORCE",
  T00010: "Huons Healthcare Legend",
  T00017: "High1 Resort High1 Winners",
  T00020: "Hana Card HanaPay",
  T00021: "SY BUILDERS",
  T00022: "Woori Financial Capital WOORI WON WEEBIES",
  T00029: "Harim YONGGARIS",
  T00030: "Breakers",
};

const TEAM_BASES_EN: Record<string, string> = {
  서울: "Seoul",
  서울특별시: "Seoul",
  경기: "Gyeonggi-do",
  경기도: "Gyeonggi-do",
  고양: "Goyang",
  화성: "Hwaseong",
  수원: "Suwon",
  안산: "Ansan",
  경주: "Gyeongju",
  제주: "Jeju",
  부산: "Busan",
  인천: "Incheon",
};

function cleanTeamName(code: string | null | undefined, rawName: string | null | undefined): string {
  const cleaned = cleanDisplayText(rawName);
  if (cleaned && !hasHangul(cleaned)) return cleaned;
  return (code && CLUB_NAMES_EN[code]) || cleaned || code || "—";
}

function cleanTeamBase(rawBase: string | null | undefined): string {
  const cleaned = cleanDisplayText(rawBase);
  if (!cleaned) return "";
  return TEAM_BASES_EN[cleaned] ?? cleaned;
}

export function normalizeTeam(raw: RawTeamStat): TeamStanding {
  return {
    code: raw.팀코드,
    name: cleanTeamName(raw.팀코드, raw.이름),
    shortName: cleanTeamName(raw.팀코드, raw.팀단축명 || raw.이름),
    rank: int(raw.순위),
    points: int(raw.승점),
    wins: int(raw.승리수),
    draws: int(raw.무승부수),
    losses: int(raw.패배수),
    winRate: num(raw.승률),
    setWins: int(raw.세트승리수),
    setLosses: int(raw.세트패배수),
    setRatio: num(raw.세트득실률),
    pointsFor: int(raw.득점),
    pointsAgainst: int(raw.실점),
    pointRatio: num(raw.점수득실률),
    matches: int(raw.경기수),
    average: num(raw.애버리지),
    highRun: int(raw.하이런),
    logo: isRealAsset(raw.ImgUrl) ? asset(raw.ImgUrl) : null,
    raw,
  };
}

export interface TeamPlayer {
  code: string;
  name: string;
  nameEn: string;
  team: string;
  teamCode: string;
  teamLogo: string | null;
  photo: string | null;
  /** Raw upstream path, for `/api/photo`. */
  photoPath: string | null;
  nation: string;
  gender: string;
  birth: string | null;
  isCaptain: boolean;
  average: number;
  winRate: number;
  setWinRate: number;
  highRun: number;
  bankShots: number;
  bankShotRate: number;
  firstShotRate: number;
  attackRate: number;
  pointsFor: number;
  pointsAgainst: number;
  innings: number;
  matches: number;
  sets: number;
  setWins: number;
  setLosses: number;
  singlesWins: number;
  singlesLosses: number;
  doublesWins: number;
  doublesLosses: number;
  raw: RawTeamPlayerStat;
}

export function normalizeTeamPlayer(raw: RawTeamPlayerStat): TeamPlayer {
  const img = raw.ImgUrl || raw.선수이미지;
  const primary = cleanPlayerName(raw.이름);
  const secondary = cleanPlayerName(raw.외국이름);
  const latin = [primary, secondary].find((v) => v && !hasHangul(v));
  const resolvedName = latin ?? romanizeKoreanName(primary || secondary);
  const sets = int(raw.세트수) || int(raw.세트승리수) + int(raw.세트패배수);

  const rawPhoto = isRealAsset(img) ? asset(img) : null;
  const rawTeamLogo = isRealAsset(raw.팀로고) ? asset(raw.팀로고) : null;

  return {
    code: raw.선수코드,
    name: resolvedName || "—",
    nameEn: resolvedName || "—",
    team: cleanTeamName(raw.팀코드, raw.팀명),
    teamCode: raw.팀코드,
    teamLogo: rawTeamLogo ? (eventArtUrl(rawTeamLogo, 128) ?? rawTeamLogo) : null,
    photo: rawPhoto ? (eventArtUrl(rawPhoto, 256) ?? rawPhoto) : null,
    photoPath: playerPhotoPath(img),
    nation: raw.국가명 || "—",
    gender: raw.성별 === "F" ? "F" : "M",
    birth: raw.생년월일 ? String(raw.생년월일).slice(0, 10) : null,
    isCaptain: raw.리더여부 === "Y",
    average: num(raw.애버리지),
    winRate: num(raw.승률),
    setWinRate: num(raw.세트승률),
    highRun: int(raw.하이런),
    bankShots: int(raw.뱅크샷),
    bankShotRate: num(raw.뱅크샷성공률),
    firstShotRate: num(raw.초구성공률),
    attackRate: num(raw.공격성공률),
    pointsFor: int(raw.득점),
    pointsAgainst: int(raw.실점),
    innings: int(raw.이닝),
    matches: int(raw.경기수) || sets,
    sets,
    setWins: int(raw.세트승리수),
    setLosses: int(raw.세트패배수),
    singlesWins: int(raw.단식승리수),
    singlesLosses: int(raw.단식패배수),
    doublesWins: int(raw.복식승리수),
    doublesLosses: int(raw.복식패배수),
    raw,
  };
}

export interface TeamProfile {
  code: string;
  rosterCode: string;
  name: string;
  shortName: string;
  logo: string | null;
  logoThumb: string | null;
  coach: string;
  base: string;
  sponsor: string;
  description: string;
  raw: RawTeamInfo;
}

/** Coach names arrive with separator junk ("ㆍㆍ", "·") or "미정" for unfilled posts. */
function cleanPersonName(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^(미정|없음|tbd|tba|n\/a|-|—|0)$/i.test(raw)) return "";
  const stripped = raw
    .replace(/^[ㆍ·.,\-\s|/]+/, "")
    .replace(/[ㆍ·.,\-\s|/]+$/, "")
    .replace(/ㆍ|·/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length < 2) return "";
  if (/^(미정|없음)$/.test(stripped)) return "";
  return stripped;
}

export function normalizeTeamProfile(raw: RawTeamInfo): TeamProfile {
  const rawCoach = cleanPersonName(raw.팀감독);
  const coach = rawCoach ? (hasHangul(rawCoach) ? romanizeKoreanName(rawCoach) : cleanPlayerName(rawCoach)) : "";
  return {
    code: raw.팀코드,
    rosterCode: String(raw.리그참여팀코드),
    name: cleanTeamName(raw.팀코드, raw.팀풀네임 || raw.팀단축명),
    shortName: cleanTeamName(raw.팀코드, raw.팀단축명 || raw.팀풀네임),
    logo: isRealAsset(raw.팀로고) ? asset(raw.팀로고) : null,
    logoThumb: isRealAsset(raw.팀로고썸네일) ? asset(raw.팀로고썸네일) : null,
    coach,
    base: cleanTeamBase(raw.팀연고지),
    sponsor: cleanDisplayText(raw.후원사명),
    description: cleanDisplayText(raw.팀설명),
    raw,
  };
}

export interface HeadToHeadCell {
  wins: number;
  losses: number;
  draws: number;
  setWins: number;
  setLosses: number;
  played: number;
}

/**
 * Build a lookup of `teamA|teamB` (with `teamA <= teamB`) -> result.
 *
 * `getTeamWinLoseByTeam` keys sides by numeric `리그참여팀코드` (e.g. `159..168`)
 * and emits two mirrored rows per pair (`A -> B` and `B -> A`) across all seasons.
 * Passing `rosterToClub` filters to the active season block, translates to club
 * codes (`T00002|T00010`), and keeps only one orientation per unordered pair.
 */
export function matchMatrix(
  matches: RawTeamMatch[],
  rosterToClub?: Map<string, string>,
): Map<string, HeadToHeadCell> {
  const matrix = new Map<string, HeadToHeadCell>();
  const seenPairs = new Set<string>();

  for (const match of matches) {
    const raw1 = String(match.참가팀코드1 ?? "").trim();
    const raw2 = String(match.참가팀코드2 ?? "").trim();
    if (!raw1 || !raw2 || raw1 === raw2) continue;

    let code1 = raw1;
    let code2 = raw2;
    if (rosterToClub && rosterToClub.size > 0) {
      const mapped1 = rosterToClub.get(raw1);
      const mapped2 = rosterToClub.get(raw2);
      if (!mapped1 || !mapped2) continue;
      code1 = mapped1;
      code2 = mapped2;
    }

    const key = [code1, code2].sort().join("|");
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);

    const existing = matrix.get(key) ?? { wins: 0, losses: 0, draws: 0, setWins: 0, setLosses: 0, played: 0 };
    const aIsFirst = code1 <= code2;
    existing.wins += aIsFirst ? int(match.승리수) : int(match.패배수);
    existing.losses += aIsFirst ? int(match.패배수) : int(match.승리수);
    existing.draws += int(match.무승부수);
    existing.setWins += aIsFirst ? int(match.세트승) : int(match.세트패);
    existing.setLosses += aIsFirst ? int(match.세트패) : int(match.세트승);
    existing.played += 1;
    matrix.set(key, existing);
  }
  return matrix;
}

/* -------------------------------------------------------------------- media */

/** Press titles and bodies are CMS HTML; titles must be flattened before display. */
export interface Article {
  seq: string;
  title: string;
  body: string;
  image: string | null;
  views: number;
  featured: boolean;
  date: Date | null;
}

export function normalizeArticle(raw: RawPress): Article {
  const rawImg = isRealAsset(raw.THUMBNAIL_FILE_PATH) ? asset(raw.THUMBNAIL_FILE_PATH) : null;
  return {
    seq: raw.SEQ,
    title: stripTags(raw.TITLE) || "Untitled release",
    body: raw.CONTENT ?? "",
    image: rawImg ? (eventArtUrl(rawImg, 768) ?? rawImg) : null,
    views: int(raw.VIEW_CNT),
    featured: raw.TOP_YN === 1,
    date: toDate(raw.VIEW_DATE ?? raw.UPDATE_DATE),
  };
}

/* ------------------------------------------------------------------- records */

/** The 26 `Category` values the season-leader feed reports. */
export const LEADER_CATEGORIES: { key: string; label: string; unit: "avg" | "int" | "pct" }[] = [
  { key: "에버리지", label: "Average", unit: "avg" },
  { key: "하이런", label: "High run", unit: "int" },
  { key: "최다승", label: "Most wins", unit: "int" },
  { key: "우승횟수", label: "Most titles", unit: "int" },
  { key: "공격성공률", label: "Attack success", unit: "pct" },
  { key: "초구성공률", label: "First-shot success", unit: "pct" },
  { key: "장타율", label: "Long-run rate", unit: "pct" },
  { key: "뱅크샷비율", label: "Bank-shot rate", unit: "pct" },
  { key: "뱅크샷", label: "Bank shots made", unit: "int" },
  { key: "기대득점", label: "Expected pts / inn", unit: "avg" },
  { key: "퍼펙트큐", label: "Perfect cues", unit: "int" },
  { key: "점수", label: "Points", unit: "int" },
  { key: "세트승", label: "Sets won", unit: "int" },
  { key: "승부치기승", label: "Shootout wins", unit: "int" },
];
