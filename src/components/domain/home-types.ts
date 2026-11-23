export type HomeCircuit = "PBA" | "LPBA" | "TEAM" | "DREAM";

export interface HomeLiveSide {
  name: string;
  memCode: string | null;
  nation: string | null;
  photo: string | null;
  setsWon: number;
  points: number | null;
  innings: number | null;
  average: number | null;
  highRun: number | null;
}

export interface HomeLiveCard {
  key: string;
  pstCode: string;
  watchUrl: string | null;
  circuit: HomeCircuit;
  tableLabel: string;
  roundLabel: string;
  latestSetNo: number;
  raceTarget: number | null;
  completedSets: number[][];
  isTeam: boolean;
  sides: HomeLiveSide[];
}

export interface HomeFixtureRow {
  key: string;
  state: "live" | "next" | "final";
  circuit: HomeCircuit;
  circuitLabel: string;
  eventTitle: string;
  round: string;
  clock: string;
  matchNo: string;
  href: string;
  pstCode: string;
  home: string;
  away: string;
  homeMemCode: string | null;
  awayMemCode: string | null;
  homeNation: string | null;
  awayNation: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeWon: boolean;
  awayWon: boolean;
  homeAvg: number | null;
  homeHr: number | null;
}

export interface HomeDaySlice {
  key: "yesterday" | "today" | "tomorrow";
  label: string;
  shortLabel: string;
  iso: string;
  partial: boolean;
  rows: HomeFixtureRow[];
}

export interface HomeRankItem {
  rank: number;
  code: string;
  name: string;
  nation: string | null;
  photo: string | null;
  circuit: string;
  value: string;
}

export interface HomeLeadStory {
  seq: string;
  title: string;
  summary: string;
  photo: string | null;
  dateLabel: string;
  viewsLabel: string;
}
