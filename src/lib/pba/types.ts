/**
 * Raw shapes returned by the pbatour.org data API.
 *
 * Two conventions coexist in the upstream service:
 *  - `{ resultCode, list }` envelopes (ranking / player / schedule endpoints)
 *  - `{ result: { list } }` envelopes (the `/stats/service/*` endpoints)
 *  - a handful of endpoints answer with Korean property names (`승리수`, `이름`, …)
 *    because the Java layer maps straight off the SQL column aliases.
 *
 * Everything here mirrors upstream verbatim; normalisation happens in
 * `normalize.ts` so that UI code never touches a Korean key or a `_EN` suffix.
 */

/** Jackson serialises `java.util.Date` as an expanded object, not an ISO string. */
export type PbaDate =
  | {
      year: number;
      monthValue: number;
      dayOfMonth: number;
      hour?: number;
      minute?: number;
      second?: number;
    }
  | string
  | null
  | undefined;

export interface PbaPage {
  total: number;
  totcnt: number;
  curPage: number;
  nTotalPageSize: number;
  nBlockSize: number;
}

export interface PbaListResponse<T> {
  resultCode: string;
  resultMsg?: string;
  list: T[];
  page: PbaPage;
}

export interface PbaResultResponse<T> {
  result?: { list: T[] };
  resultCode?: string;
}

/* ------------------------------------------------------------------ leagues */

export interface RawLeague {
  LeagueName: string;
  LeagueCode: string;
}

/* ------------------------------------------------------------------ seasons */

export interface RawSeason {
  SeasonCode: string;
  SeasonTitle: string;
}

/* --------------------------------------------------------------- tournaments */

export interface RawTournament {
  SEQ: string;
  TITLE: string;
  TITLE_EN: string;
  MATCH_START_DATE: PbaDate;
  MATCH_END_DATE: PbaDate;
  MATCH_START_DATE_NAME?: string;
  MATCH_END_DATE_NAME?: string;
  PLACE: string;
  PLACE_EN: string;
  LEAGUE_GUBUN: string;
  SEASON_GUBUN: string;
  SPONSOR: string;
  SPONSOR_EN: string;
  TOTAL_PRIZE: string;
  TOTAL_PRIZE_EN: string;
  WINNING_PRIZE: string;
  WINNING_PRIZE_EN: string;
  BROADCAST: string;
  BROADCAST_EN: string;
  PREV_WINNER_NAME: string;
  PREV_WINNER_NAME_EN: string;
  TABLE_MODEL: string;
  BALL_MODEL: string;
  CLOTH_MODEL: string;
  JOIN_PLAYER: string;
  JOIN_TEAM: string;
  MATCH_CODE: string;
  TOP_YN: number;
  VIEW_YN: number;
  SPONSOR_LOGO_FILE_PATH: string;
  DETAIL_BTN_ACTIVE_YN: number;
  TOURNAMENT_GUIDE_URL?: string;
  TOURNAMENT_GUIDE_URL_EN?: string;
}

export interface RawTournamentDetail extends RawTournament {
  PATH?: string;
  PATH_EN?: string;
  tourCode?: string;
  leagueCode?: string;
  season?: string;
  AWARD?: unknown;
}

/* ------------------------------------------------------------------- player */

export interface RawPlayer {
  MemCode: string;
  PlayerNameKO: string;
  PlayerNameEN: string;
  PlayerNameKOShort: string;
  PlayerNameENShort: string;
  NationCode: string;
  Gender: string;
  BirthDay: string;
  LeagueCode: string;
  ImgURL: string;
  ImgURLBig: string;
  Average: number;
  HR: number;
  BankShotRate: number;
  Win: number;
  Lose: number;
  Draw: number;
  Prize: number;
  PrizeRank: number;
  RankingPoint: number;
  RankingPointRank: number;
  num?: number;
  tcnt?: number;
}

/* ------------------------------------------------------------------ ranking */

export interface RawRankingRow {
  Rank: number;
  num?: number;
  MemCode: string;
  PlayerNameKO: string;
  PlayerNameEN: string;
  PlayerNameKOShort: string;
  PlayerNameENShort: string;
  NationCode: string;
  Gender: string;
  ImgURL: string;
  ImgURLBig: string;
  Prize: number;
  RankingPoint: number;
  PrizeRank: number;
  RankingPointRank: number;
  RankBy?: string;
  tcnt?: number;
}

export interface RawRankTour {
  TourCode: string;
  TourTitle: string;
  TourTitleEn: string;
  StartDay?: PbaDate;
}

/* ------------------------------------------------------- player stats (서비스) */

/** Korean-keyed season / tour statistics row. */
export interface RawPlayerStat {
  MemCode: string;
  MemName?: string;
  NationCode?: string;
  BirthDay?: string;
  ImgUrl?: string;
  PBAType?: string;
  TourCode?: number | string;
  TourTitle?: string;
  TourTitleEn?: string;
  SeasonCode?: string;
  /** wins */
  승리수?: number;
  /** losses */
  패배수?: number;
  /** set wins */
  세트승리수?: number;
  /** set losses */
  세트패배수?: number;
  /** average (carom average per inning) */
  에버리지?: number;
  /** high run */
  하이런?: number;
  /** total points scored */
  점수?: number;
  /** one-point attempts scored */
  원포인트?: number;
  /** two-point attempts scored */
  투포인트?: number;
  /** innings played */
  이닝수?: number;
  /** matches played */
  경기수?: number;
  /** win rate */
  승률?: number;
  뱅크샷?: number;
  뱅크샷비율?: number;
  장타수?: number;
  장타율?: number;
  초구성공률?: number;
  공격성공수?: number;
  공격시도수?: number;
  공격성공률?: number;
  승부치기승률?: number;
  총점?: number;
  상금?: number;
  랭킹포인트?: number;
  /* ranks */
  에버리지순위?: number;
  하이런순위?: number;
  승률순위?: number;
  뱅크샷비율순위?: number;
  장타율순위?: number;
  초구성공률순위?: number;
  공격성공률순위?: number;
  승부치기승률순위?: number;
  총점순위?: number;
  상금순위?: number;
  랭킹포인트순위?: number;
}

export interface RawChampion {
  TourTitle: string;
  TourTitleEn: string;
  SeasonCode: string;
  SeasonTitle: string;
}

export interface RawSeasonRank {
  TourCode: number;
  MemCode: string;
  랭킹포인트순위?: number;
  우승횟수?: number;
  참가대회?: number;
  랭킹포인트?: number;
  상금순위?: number;
  에버리지순위?: number;
  상금?: number;
}

export interface RawTotalRank {
  TourCode: number;
  MemCode: string;
  참가횟수?: number;
  우승횟수?: number;
  랭킹포인트?: number;
  상금?: number;
}

export interface RawTop5Row {
  Category: string;
  Rank: number;
  MemCode: string;
  MemName: string;
  MemNameEn: string;
  NationCode: string;
  ImgUrl: string;
  Value: number | string;
  Innings?: number;
  PBAType?: string;
}

/**
 * `/stats/service/period` — one row per player for a date window.
 *
 * This is the widest row the association publishes. Keys are the Korean SQL
 * column aliases from the reporting view, so they are mirrored verbatim and
 * normalised in `../period.ts`.
 */
export interface RawPeriodStat {
  MemCode: string;
  NameFull?: string;
  NameShort?: string;
  PBAType?: string;
  /** wins */
  승수: number;
  /** losses */
  패수: number;
  /** sets won */
  "세트 승": number;
  /** sets lost */
  "세트 패": number;
  /** set difference */
  "세트 득실": number;
  /** points scored */
  점수: number;
  /** innings played */
  이닝: number;
  /** average points per inning, as published */
  에버리지?: number;
  /** high run */
  하이런: number;
  /** average innings per match */
  "평균 이닝"?: number;
  /** attack attempts */
  공격시도횟수: number;
  /** attack conversions */
  공격성공횟수: number;
  /** attack success rate, percent */
  "공격 성공율"?: number;
  /** single-point conversions */
  "1득점 횟수": number;
  /** long runs */
  장타: number;
  /** long-run rate, percent */
  장타율?: number;
  /** bank shots made */
  "뱅크샷 횟수": number;
  /** bank-shot rate, percent */
  "뱅크샷 비율"?: number;
  /** first-shot success rate, percent */
  "초구 성공율"?: number;
  /** expected points per visit */
  "기대 득점"?: number;
  /** closing probability, percent */
  "끝내기 확률"?: number;
  /** tiebreak wins */
  "승부치기 승": number;
  /** tiebreak losses */
  "승부치기 패": number;
  /** tiebreak win rate, percent */
  "승부치기 승률"?: number;
  /** tiebreak: billed first */
  "승부치기 선공 횟수": number;
  "승부치기 선공 승률"?: number;
  /** tiebreak: billed second */
  "승부치기 후공 횟수": number;
  "승부치기 후공 승률"?: number;
  "승부치기 하이런": number;
}

/* ------------------------------------------------------------- team league */

export interface RawTeamSeason {
  시즌명: string;
  시즌시작월: string;
  리그제목: string;
  스폰서: string;
  설명: string;
  리그코드: number;
  시즌코드: string;
  리그시작일자: string;
  리그종료일자: string;
  경기명코드: string;
  상금: number;
}

export interface RawTeamRound {
  라운드: number;
  라운드코드: number | string;
  포스트여부: string;
  시작일자: string;
  종료일자: string;
  진행상황: string;
  경기장소: string;
  리그제목: string;
  기타사항?: string;
  대회선택여부?: string;
}

export interface RawTeamStat {
  이름: string;
  팀코드: string;
  팀단축명: string;
  ImgUrl: string;
  순위: number;
  승점: number;
  승리수: number;
  무승부수: number;
  패배수: number;
  승률: number;
  세트승리수: number;
  세트패배수: number;
  세트득실률: number;
  득점: number;
  실점: number;
  점수득실률: number;
  세트수: number;
  경기수: number;
  애버리지: number;
  애버리지순위: number;
  하이런: number;
  평균이닝: number;
  평균득점: number;
  퍼펙트큐?: number;
  뱅크샷성공률?: number;
  초구성공률?: number;
  공격성공률?: number;
  상대전적승?: number;
  상대전적패?: number;
  승차?: number;
}

export interface RawTeamPlayerStat {
  선수코드: string;
  이름: string;
  외국이름?: string;
  선수단축명?: string;
  팀명: string;
  팀코드: string;
  팀단축명: string;
  팀로고: string;
  팀로고썸네일?: string;
  선수이미지?: string;
  성별: string;
  생년월일: string;
  국가명: string;
  국가이미지: string;
  리더여부?: string;
  애버리지: number;
  애버리지순위: number;
  승률: number;
  승률순위?: number;
  세트승률?: number;
  하이런: number;
  하이런순위?: number;
  장타: number;
  장타율?: number;
  뱅크샷: number;
  뱅크샷성공률?: number;
  뱅크샷성공률순위?: number;
  초구성공률?: number;
  초구성공률순위?: number;
  공격성공률?: number;
  공격성공률순위?: number;
  득점: number;
  실점: number;
  이닝: number;
  경기수: number;
  세트수: number;
  세트승리수: number;
  세트패배수: number;
  단식승리수: number;
  단식패배수: number;
  복식승리수: number;
  복식패배수: number;
  남자단식승리수: number;
  남자단식패배수: number;
  여자단식승리수: number;
  여자단식패배수: number;
  남자복식승리수: number;
  남자복식패배수: number;
  여자복식승리수: number;
  여자복식패배수: number;
  혼합복식승리수: number;
  혼합복식패배수: number;
  퍼펙트큐?: number;
  끝내기확률?: number;
  평균득점?: number;
}

export interface RawTeamInfo {
  팀코드: string;
  리그참여팀코드: string;
  팀풀네임: string;
  팀단축명: string;
  팀로고: string;
  팀로고썸네일: string;
  팀감독: string;
  팀연고지: string;
  후원사명: string;
  팀설명: string;
  몰수패여부?: string;
}

export interface RawTeamMatch {
  참가팀코드1: string;
  참가팀코드2: string;
  승리수: number;
  패배수: number;
  무승부수: number;
  세트승: number;
  세트패: number;
  세트무: number;
}

/* ------------------------------------------------------------------- media */

export interface RawPress {
  SEQ: string;
  TITLE: string;
  CONTENT: string;
  GUBUN: string;
  TYPE: string;
  THUMBNAIL_FILE_PATH: string;
  THUMBNAIL_FILE_NAME: string;
  VIEW_CNT: number;
  TOP_YN: number;
  VIEW_DATE: PbaDate;
  UPDATE_DATE: PbaDate;
  ROWNUM?: number;
  LOCALE_GUBUN?: string;
}

export interface RawVideo {
  SEQ: string;
  TITLE: string;
  VIDEO_URL: string;
  VIDEO_NAME: string;
  VIDEO_NAME_EN: string;
  IMAGE_FILE_PATH: string;
  IMAGE_FILE_NAME: string;
  IMAGE_ALT: string;
  ROWNUM?: number;
}

export interface RawGallery {
  SEQ: string;
  TITLE: string;
  CONTENT: string;
  IMAGE_FULL_PATH: string;
  ALT: string;
  TOP_YN: number;
  VIEW_CNT: number;
  VIEW_DATE: PbaDate;
  ROWNUM?: number;
}

/* ------------------------------------------------------------------ awards */

export interface RawAward {
  SEASON: string;
  PBA_NAME: string;
  LPBA_NAME: string;
  RALLY_NAME: string;
  PBA_DESCRIPTION: string;
  PBA_DES2: string;
  LPBA_DESCRIPTION: string;
  LPBA_DES2: string;
}

/** `/service/ajax/tour/getTourList` — one row per completed or scheduled tour. */
export interface RawTour {
  투어명: string;
  투어시작일자: string;
  투어종료일자: string;
  PBA타입: string;
  우승자: string;
  로고이미지: string;
  투어코드: number;
  시즌코드: number;
  등록일자: string;
}

/**
 * `/stats/service/headtohead` — a wide row holding both sides' aggregates for
 * every meeting between two members. Field names are snake_case here, unlike
 * the rest of the service.
 */
export interface RawHeadToHead {
  total_matches: number;
  average_innings: number;

  player1_name: string;
  player1_img: string;
  player1_NationImgURL: string;
  player1_wins: number;
  player1_win_rate: number;
  player1_average: number;
  player1_hr: number;
  player1_inn: number;
  player1_total_score: number;
  player1_total_attempts: number;
  player1_total_success: number;
  player1_success_rate: number;
  player1_1point: number;
  player1_2point: number;
  player1_2point_rate: number;
  player1_long_cnt: number;
  player1_long_rate: number;
  player1_first_shot_try: number;
  player1_first_shot_success: number;
  player1_first_shot_rate: number;
  player1_closing_rate: number;
  player1_set_wins: number;
  player1_set_diff: number;

  player2_name: string;
  player2_img: string;
  player2_NationImgURL: string;
  player2_wins: number;
  player2_win_rate: number;
  player2_average: number;
  player2_hr: number;
  player2_inn: number;
  player2_total_score: number;
  player2_total_attempts: number;
  player2_total_success: number;
  player2_success_rate: number;
  player2_1point: number;
  player2_2point: number;
  player2_2point_rate: number;
  player2_long_cnt: number;
  player2_long_rate: number;
  player2_first_shot_try: number;
  player2_first_shot_success: number;
  player2_first_shot_rate: number;
  player2_closing_rate: number;
  player2_set_wins: number;
  player2_set_diff: number;
}

/* ------------------------------------------------------------ home payload */

export interface RawHomeInfo {
  pressList: RawPress[];
  noticeList: RawPress[];
  pointRankingList: RawRankingRow[];
  prizeRankingList: RawRankingRow[];
  galleryList: RawGallery[];
  movieList: RawVideo[];
  socialList: unknown[];
  bannerList: unknown[];
  popupList: unknown[];
  ruleList: unknown[];
  tableList: unknown[];
  formList: unknown[];
  guideList: unknown[];
}
