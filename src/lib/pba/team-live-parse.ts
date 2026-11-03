/**
 * Pure parsers for the team-league terminal's live page.
 *
 * `http://team.pbatour.org/mob/ko/live.asp` is the only surface that publishes a
 * team-league fixture while it is being played. The main scoring terminal's live
 * board answers an empty fragment for this circuit, which is why `/live` used to
 * report "no match in play" during a running round.
 *
 * The page stacks three sections — in progress, up next, results — and the one
 * that matters here is the `teamleague-status-listbox` whose `<li>` carries
 * `class="in-progress"`. Inside it:
 *
 *   <div class="tbl_info"><span>PBA 스타디움</span>… 3 Set … inn 2 …
 *   <ul class="score_01">
 *     <li>                                ← home club
 *       <span class="spbox w_80 lword">크라운해태 라온</span>
 *       <span class="set_point">2</span>  ← sets won
 *       <span class="number0 t22 g_col">6</span>  ← points in the set being played
 *       <span class="n_col">마르티네스</span>    ← the player on the table
 *       AVG 3.000 / HR 6
 *     <li>                                ← away club, mirrored
 *
 * No imports: the markup contract is testable offline, like the other parsers.
 */

export interface LiveClubSide {
  /** Club display name, Korean as published ("하나카드 하나페이"). */
  nameKo: string;
  /** Club code from the player link, when the row carries one. */
  clubCode: string | null;
  /** Sets won in the fixture so far. */
  sets: number | null;
  /** Points in the set being played. */
  points: number | null;
  /** The player (or doubles pair) currently on the table for this club. */
  player: string | null;
  average: number | null;
  highRun: number | null;
  logo: string | null;
  won: boolean;
}

export interface LiveTeamFixture {
  /** "PBA 스타디움". */
  venue: string | null;
  /** "3 Set". */
  setLabel: string | null;
  setNo: number | null;
  /** "inn 2". */
  innings: number | null;
  /** Broadcast link the page attached, usually YouTube. */
  watchUrl: string | null;
  sides: LiveClubSide[];
  /**
   * Every bout of the fixture the page lists, newest first: the ones already
   * played, and the line-ups announced for the ones still to come. A fixture is
   * six bouts, so this is where the detail of a live match actually lives.
   */
  bouts: LiveBout[];
}

export interface LiveBout {
  /** "Set 3" → 3. */
  setNo: number | null;
  /** Race format as published, "GP9" / "GP11" / "GP15". */
  format: string | null;
  /** Local `YYYY-MM-DD HH:MM` the bout started, when it has. */
  playedAt: string | null;
  /** `scheduled` until a result is recorded, then `final`. */
  status: "scheduled" | "final";
  sides: LiveBoutSide[];
}

export interface LiveBoutSide {
  /** Singles name, or a doubles pair ("김재근,임정숙"). */
  name: string;
  /** Points over innings, as published: "15P / 8". */
  points: number | null;
  innings: number | null;
  average: number | null;
  highRun: number | null;
  won: boolean;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function text(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function number(value: string | null | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9.\-]/g, "");
  if (digits === "" || digits === "-" || digits === ".") return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `11P / 8` → points 11, innings 8. A bout still to be played publishes `-`. */
const POINTS_INNINGS = /^(\d+)\s*P\s*\/\s*(\d+)$/i;

/** One side of one bout. The heading row publishes "Point/inn" and is skipped. */
function parseBoutSide(item: string): LiveBoutSide | null {
  const name = text(item.match(/class="t_name"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  if (!name || /^player$/i.test(name)) return null;

  const scoreCell = text(item.match(/class="t_set"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const score = POINTS_INNINGS.exec(scoreCell);
  // A scheduled bout shows "-" in every column. It is published, so the side is
  // kept: the line-up of a bout still to be played is part of the live picture.
  const scheduled = scoreCell === "-" || scoreCell === "–";
  if (!score && !scheduled) return null;

  const order = text(item.match(/class="t_order"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/i)?.[1] ?? "");
  return {
    name,
    points: score ? number(score[1]) : null,
    innings: score ? number(score[2]) : null,
    average: number(text(item.match(/class="t_avg"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "")),
    highRun: number(text(item.match(/class="t_high"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "")),
    // Only a played bout carries the mark; a scheduled row publishes "예정".
    won: /class="icon_win"/i.test(item),
  };
}

/** One `li.completed` bout block: SET n, format, kickoff, and two sides. */
function parseBout(block: string): LiveBout | null {
  const heading = text(block.match(/class="no_order[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const setNo = number(heading.match(/SET\s*(\d+)/i)?.[1] ?? null);
  if (setNo === null) return null;

  const plain = text(block);
  const format = block.match(/\b(GP\d{1,3})\b/i)?.[1] ?? null;
  const stamp = plain.match(/(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2})/)?.[1] ?? null;

  const sides: LiveBoutSide[] = [];
  for (const item of block.split(/<li\b/i).slice(1)) {
    const side = parseBoutSide(item);
    if (side) sides.push(side);
    if (sides.length === 2) break;
  }
  if (sides.length < 2) return null;

  return {
    setNo,
    format,
    playedAt: stamp,
    status: sides.some((side) => side.won) ? "final" : "scheduled",
    sides,
  };
}

/** One `<li>` of `score_01` → one club side. */
function parseSide(item: string, home: boolean): LiveClubSide | null {
  const nameKo =
    text(item.match(/class="spbox w_80 lword"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "") ||
    text(item.match(/alt="([^"]*)"/i)?.[1] ?? "");
  if (!nameKo) return null;

  const sets = number(
    text(item.match(/class="set_point(?:_rgt)?"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ""),
  );

  const pointsBox = item.match(/class="point_box0[12]"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/i)?.[1] ??
    item.match(/class="point_box0[12]"[^>]*>([\s\S]*?)$/i)?.[1] ??
    "";
  const points = number(text(pointsBox.match(/class="number0 t22[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ""));
  const player = text(pointsBox.match(/class="n_col"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "") || null;

  const average = number(
    text(
      pointsBox.match(/AVG<\/span>\s*<span class="avg_col"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
        pointsBox.match(/class="avg_col"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
        "",
    ),
  );
  // The HR value is the second `avg_col` span in the box.
  const averages = [...pointsBox.matchAll(/class="avg_col"[^>]*>([\s\S]*?)<\/span>/gi)].map((match) =>
    number(text(match[1])),
  );
  const highRun = averages.length >= 2 ? averages[averages.length - 1] : null;

  const clubCode = item.match(/comPlayerInfoTour\([^)]*?'(\d+)'/i)?.[1] ?? null;
  const logo = home
    ? item.match(/class="player_lft[^"]*"[\s\S]*?src="([^"]+)"/i)?.[1] ?? null
    : item.match(/class="player_rgt[^"]*"[\s\S]*?src="([^"]+)"/i)?.[1] ?? null;

  return {
    nameKo,
    clubCode,
    sets,
    points,
    player,
    average,
    highRun,
    logo,
    won: /class="[^"]*icon_win[^"]*"/i.test(item),
  };
}

/**
 * The fixtures on the table right now — normally zero or one, but a round can
 * run two tables at once.
 */
export function parseLiveTeamFixtures(html: string | null): LiveTeamFixture[] {
  if (!html) return [];

  const clean = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const fixtures: LiveTeamFixture[] = [];
  const blocks = clean.split(/<li class="in-progress"/i).slice(1);

  for (const block of blocks) {
    // The item ends where the next list item begins.
    const item = block.split(/<\/ul>\s*<\/li>/i)[0];
    const scoreList = item.match(/<ul class="score_01"[^>]*>([\s\S]*)$/i)?.[1] ?? item;
    const clubs = scoreList.split(/<li\b/i).slice(1);

    const sides: LiveClubSide[] = [];
    for (const [index, club] of clubs.entries()) {
      const side = parseSide(club, index === 0);
      if (side) sides.push(side);
      if (sides.length === 2) break;
    }
    if (sides.length < 2) continue;

    // The header is venue | "3 Set" | "inn 2". It is read from the raw text
    // rather than matched inside the markup: the button box that follows it
    // carries another `tbl_info`-shaped span, and a lazy match anchored on that
    // span silently fails on the real page.
    const headerText = text(
      item.slice(
        Math.max(0, item.indexOf("<div class=\"tbl_info\">")),
        item.indexOf("<span class=\"btn_box") > 0
          ? item.indexOf("<span class=\"btn_box")
          : item.indexOf("<div class=\"tbl_info\">") + 600,
      ),
    );
    const venue = headerText.match(/^([^|]+?)\s*(?:\||\d+\s*Set|inn\b)/i)?.[1]?.trim() ?? null;
    const setLabel = headerText.match(/(\d+)\s*Set/i)?.[0] ?? null;
    const setNo = number(setLabel);
    const innings = number(headerText.match(/inn\s*(\d+)/i)?.[1] ?? null);
    const watchUrl =
      item.match(/openWebBrowser\('([^']+)'\)/i)?.[1] ??
      item.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/[\w?=&%./-]+|youtu\.be\/[\w-]+)/i)?.[0] ??
      null;

    // The bouts follow the fixture block, each one a `li.completed` carrying its
    // own SET heading and score rows.
    const bouts: LiveBout[] = [];
    for (const segment of block.split(/<li class="completed"/i).slice(1)) {
      const bout = parseBout(segment.split(/<\/ul>\s*<\/li>/i)[0]);
      if (bout) bouts.push(bout);
    }
    bouts.sort((a, b) => (b.setNo ?? 0) - (a.setNo ?? 0));

    fixtures.push({ venue, setLabel, setNo, innings, watchUrl, sides, bouts });
  }

  return fixtures;
}
