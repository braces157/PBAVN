/**
 * Pure binary-tree topology for PBA / LPBA knockout draws.
 *
 * Verified empirically against `app.pbatour.org` bracket feeds:
 * - PBA 128-draw: R128 #1..64 -> R64 #65..96 -> R32 #97..112 -> R16 #113..120
 *   -> QF #121..124 -> SF #125..126 -> Final #127.
 * - LPBA 64-draw: R64 #65..96 -> R32 #1..16 -> R16 #17..24 -> QF #25..28
 *   -> SF #29..30 -> Final #31.
 *
 * In every round `S` (`S` in {128, 64, 32, 16, 8, 4, 2}), a match's 0-based
 * position inside the round is `(matchNo - 1) % (S / 2)`, and matches `2i` and
 * `2i + 1` always feed into slot `i` of round `S / 2`.
 */

import type { BracketMatch } from "./pba/bracket-parse";

const ROUND_NAMES: Record<number, string> = {
  2: "Final",
  4: "Semi-final",
  8: "Quarter-final",
  16: "Round of 16",
  32: "Round of 32",
  64: "Round of 64",
  128: "Round of 128",
  256: "Round of 256",
};

function bracketRound(size: number): string {
  return ROUND_NAMES[size] ?? `Bracket of ${size}`;
}

export interface TreeSide {
  name: string;
  memCode: string | null;
  sets: number | null;
  average: number | null;
  highRun: number | null;
  won: boolean;
  /** True when propagated from the previous round's winner before the match is published. */
  projected?: boolean;
  /** True when awaiting an earlier unplayed match (e.g. "Winner of #12"). */
  placeholder?: boolean;
}

export interface BracketNode {
  /** Stable key: `${bracketSize}-${slot}` */
  id: string;
  bracketSize: number;
  round: string;
  /** 0-based index within the round (`0 .. bracketSize/2 - 1`). */
  slot: number;
  /** Expected official match number (used for placeholder labels). */
  displayMatchNo: number;
  /** Actual published match from upstream, or null if not yet played/published. */
  match: BracketMatch | null;
  sides: [TreeSide, TreeSide];
  decided: boolean;
  isShootout: boolean;
  isPointsRound: boolean;
  /** Which quarter (`0..3`) this node belongs to, or null for SF/Final. */
  quarter: number | null;
}

export interface RoundProgress {
  bracketSize: number;
  round: string;
  shortLabel: string;
  formatLabel: string | null;
  totalSlots: number;
  playedCount: number;
}

export interface BracketSection {
  id: string;
  label: string;
  shortLabel: string;
  /** Rounds displayed left-to-right in this section. */
  rounds: number[];
  /** Slot slice `[start, end)` in the FIRST round of `rounds` (subsequent rounds halve cleanly). */
  startSlot: number;
  slotCount: number;
  playedCount: number;
  totalCount: number;
}

export interface BracketTreeData {
  drawSize: number;
  rounds: number[];
  /** Map from `bracketSize` to array of `bracketSize / 2` nodes in slot order. */
  byRound: Record<number, BracketNode[]>;
  progress: RoundProgress[];
  sections: BracketSection[];
  defaultSectionId: string;
}

export function shortRoundLabel(bracketSize: number): string {
  switch (bracketSize) {
    case 128:
      return "R128";
    case 64:
      return "R64";
    case 32:
      return "R32";
    case 16:
      return "R16";
    case 8:
      return "QF";
    case 4:
      return "SF";
    case 2:
      return "Final";
    default:
      return `R${bracketSize}`;
  }
}

export function roundFormatHint(league: string | undefined, bracketSize: number): string | null {
  if (league === "LPBA1") {
    if (bracketSize >= 64) return "25 pts · 50 min";
    if (bracketSize >= 8) return "Bo5 · 11/9 pts";
    return "Bo7 · 11/9 pts";
  }
  if (league === "PBA1" || league === "PBA2" || league === "PBA3") {
    if (bracketSize >= 64) return "Bo4 + SO · 15 pts";
    if (bracketSize >= 8) return "Bo5 · 15/11 pts";
    return "Bo7 · 15/11 pts";
  }
  return null;
}

function parseMatchNum(matchNo: string): number | null {
  const digits = matchNo.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function expectedMatchNo(drawSize: number, bracketSize: number, slot: number, league?: string): number {
  // LPBA 64-draw numbers R64 as 65..96 and R32..Final as 1..31.
  if (league === "LPBA1" && drawSize === 64) {
    if (bracketSize === 64) return 65 + slot;
    return 32 - bracketSize + slot + 1;
  }
  return drawSize - bracketSize + slot + 1;
}

function inferDrawSize(matches: BracketMatch[], league?: string, entrants?: number | null): number {
  const maxBracket = matches.reduce((max, m) => Math.max(max, m.bracketSize), 0);
  if (maxBracket >= 128) return 128;
  if (maxBracket >= 64) return 64;
  if (maxBracket >= 32) return 32;
  if (maxBracket >= 16) return 16;
  if (entrants && entrants > 64) return 128;
  if (entrants && entrants > 32) return 64;
  if (league === "PBA1" || league === "PBA2") return 128;
  if (league === "LPBA1") return 64;
  return 32;
}

function emptySide(label: string): TreeSide {
  return {
    name: label,
    memCode: null,
    sets: null,
    average: null,
    highRun: null,
    won: false,
    placeholder: true,
  };
}

export function buildBracketTree(
  matches: BracketMatch[],
  options: { league?: string; entrants?: number | null } = {},
): BracketTreeData {
  const { league, entrants } = options;
  const drawSize = inferDrawSize(matches, league, entrants);
  const rounds: number[] = [];
  for (let s = drawSize; s >= 2; s = s / 2) {
    rounds.push(s);
  }

  // Place published matches into their exact `(bracketSize, slot)` bucket.
  const placed = new Map<string, BracketMatch>();
  const collisions: BracketMatch[] = [];
  for (const m of matches) {
    if (!rounds.includes(m.bracketSize)) continue;
    const slots = m.bracketSize / 2;
    const num = parseMatchNum(m.matchNo);
    if (num !== null) {
      const slot = (num - 1) % slots;
      const key = `${m.bracketSize}-${slot}`;
      if (!placed.has(key)) {
        placed.set(key, m);
        continue;
      }
    }
    collisions.push(m);
  }

  // Fallback for any row lacking a parseable matchNo: fill first free slot in its round.
  for (const m of collisions) {
    const slots = m.bracketSize / 2;
    for (let slot = 0; slot < slots; slot += 1) {
      const key = `${m.bracketSize}-${slot}`;
      if (!placed.has(key)) {
        placed.set(key, m);
        break;
      }
    }
  }

  const byRound: Record<number, BracketNode[]> = {};

  // Build earliest round -> Final so winners propagate cleanly into unplayed next-round slots.
  for (let rIdx = 0; rIdx < rounds.length; rIdx += 1) {
    const bracketSize = rounds[rIdx];
    const slots = bracketSize / 2;
    const prevRound = rIdx > 0 ? byRound[rounds[rIdx - 1]] : null;
    const isPointsRound = league === "LPBA1" && bracketSize >= 64;
    const nodes: BracketNode[] = [];

    for (let slot = 0; slot < slots; slot += 1) {
      const key = `${bracketSize}-${slot}`;
      const match = placed.get(key) ?? null;
      const num = match ? parseMatchNum(match.matchNo) : null;
      const displayMatchNo = num ?? expectedMatchNo(drawSize, bracketSize, slot, league);

      const quarter =
        bracketSize >= 8 ? Math.floor((slot * 4) / slots) : null;

      let sides: [TreeSide, TreeSide];
      let decided = false;

      if (match && match.sides.length >= 2) {
        decided = match.sides.some((s) => s.won);
        sides = [
          {
            name: match.sides[0].name,
            memCode: match.sides[0].memCode,
            sets: match.sides[0].sets,
            average: match.sides[0].average,
            highRun: match.sides[0].highRun,
            won: match.sides[0].won,
          },
          {
            name: match.sides[1].name,
            memCode: match.sides[1].memCode,
            sets: match.sides[1].sets,
            average: match.sides[1].average,
            highRun: match.sides[1].highRun,
            won: match.sides[1].won,
          },
        ];
      } else if (prevRound) {
        const childA = prevRound[slot * 2];
        const childB = prevRound[slot * 2 + 1];
        const sideFromChild = (child: BracketNode | undefined): TreeSide => {
          if (!child) return emptySide("TBD");
          const winner = child.decided ? child.sides.find((s) => s.won) : null;
          if (winner) {
            return {
              name: winner.name,
              memCode: winner.memCode,
              sets: null,
              average: null,
              highRun: null,
              won: false,
              projected: true,
            };
          }
          return emptySide(`Winner #${child.displayMatchNo}`);
        };
        sides = [sideFromChild(childA), sideFromChild(childB)];
      } else {
        sides = [emptySide("TBD"), emptySide("TBD")];
      }

      const isShootout =
        !isPointsRound &&
        decided &&
        sides[0].sets !== null &&
        sides[0].sets === sides[1].sets &&
        sides[0].sets === 2;

      nodes.push({
        id: key,
        bracketSize,
        round: bracketRound(bracketSize),
        slot,
        displayMatchNo,
        match,
        sides,
        decided,
        isShootout,
        isPointsRound,
        quarter,
      });
    }

    byRound[bracketSize] = nodes;
  }

  const progress: RoundProgress[] = rounds.map((size) => {
    const nodes = byRound[size] ?? [];
    return {
      bracketSize: size,
      round: bracketRound(size),
      shortLabel: shortRoundLabel(size),
      formatLabel: roundFormatHint(league, size),
      totalSlots: nodes.length,
      playedCount: nodes.filter((n) => n.match !== null).length,
    };
  });

  const sections: BracketSection[] = [];
  if (drawSize >= 128) {
    const qRounds = [128, 64, 32, 16, 8];
    for (let q = 0; q < 4; q += 1) {
      const startSlot = q * 16;
      const r128Slice = (byRound[128] ?? []).slice(startSlot, startSlot + 16);
      const playedInQ = qRounds.reduce((acc, sz, idx) => {
        const factor = 2 ** idx;
        const start = startSlot / factor;
        const count = 16 / factor;
        return acc + (byRound[sz] ?? []).slice(start, start + count).filter((n) => n.match !== null).length;
      }, 0);
      sections.push({
        id: `q${q + 1}`,
        label: `Quarter ${q + 1}`,
        shortLabel: `Q${q + 1}`,
        rounds: qRounds,
        startSlot,
        slotCount: 16,
        playedCount: playedInQ,
        totalCount: 31, // 16 + 8 + 4 + 2 + 1
      });
      void r128Slice;
    }
    const finalsRounds = [16, 8, 4, 2];
    const finalsPlayed = finalsRounds.reduce(
      (acc, sz) => acc + (byRound[sz] ?? []).filter((n) => n.match !== null).length,
      0,
    );
    sections.push({
      id: "finals",
      label: "Finals (R16 → Final)",
      shortLabel: "Finals",
      rounds: finalsRounds,
      startSlot: 0,
      slotCount: 8,
      playedCount: finalsPlayed,
      totalCount: 15,
    });
  } else if (drawSize === 64) {
    const halfRounds = [64, 32, 16, 8, 4];
    for (let h = 0; h < 2; h += 1) {
      const startSlot = h * 16;
      const playedInHalf = halfRounds.reduce((acc, sz, idx) => {
        const factor = 2 ** idx;
        const start = startSlot / factor;
        const count = 16 / factor;
        return acc + (byRound[sz] ?? []).slice(start, start + count).filter((n) => n.match !== null).length;
      }, 0);
      sections.push({
        id: h === 0 ? "top" : "bottom",
        label: h === 0 ? "Top Half" : "Bottom Half",
        shortLabel: h === 0 ? "Top Half" : "Bottom Half",
        rounds: halfRounds,
        startSlot,
        slotCount: 16,
        playedCount: playedInHalf,
        totalCount: 31,
      });
    }
    const finalsRounds = [16, 8, 4, 2];
    const finalsPlayed = finalsRounds.reduce(
      (acc, sz) => acc + (byRound[sz] ?? []).filter((n) => n.match !== null).length,
      0,
    );
    sections.push({
      id: "finals",
      label: "Finals (R16 → Final)",
      shortLabel: "Finals",
      rounds: finalsRounds,
      startSlot: 0,
      slotCount: 8,
      playedCount: finalsPlayed,
      totalCount: 15,
    });
  } else {
    const total = rounds.reduce((acc, sz) => acc + sz / 2, 0);
    const played = rounds.reduce(
      (acc, sz) => acc + (byRound[sz] ?? []).filter((n) => n.match !== null).length,
      0,
    );
    sections.push({
      id: "full",
      label: `Full Draw (${shortRoundLabel(drawSize)} → Final)`,
      shortLabel: "Full Draw",
      rounds,
      startSlot: 0,
      slotCount: drawSize / 2,
      playedCount: played,
      totalCount: total,
    });
  }

  // Smart default: if R16+ has matches, show Finals; else show first section with played matches.
  const finalsSection = sections.find((s) => s.id === "finals");
  const defaultSectionId =
    finalsSection && finalsSection.playedCount > 0
      ? "finals"
      : sections.find((s) => s.playedCount > 0)?.id ?? sections[0]?.id ?? "full";

  return {
    drawSize,
    rounds,
    byRound,
    progress,
    sections,
    defaultSectionId,
  };
}

export interface BracketPlayerHit {
  key: string;
  name: string;
  memCode: string | null;
  sectionId: string;
  sectionLabel: string;
  latestRound: string;
  stillAlive: boolean;
  nodeIds: string[];
}

function normSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collect every unique player present in the bracket for instant search & path highlighting. */
export function indexBracketPlayers(tree: BracketTreeData): BracketPlayerHit[] {
  const byKey = new Map<
    string,
    {
      name: string;
      memCode: string | null;
      quarter: number | null;
      deepestSize: number;
      latestRound: string;
      eliminated: boolean;
      nodeIds: Set<string>;
    }
  >();

  for (const size of tree.rounds) {
    for (const node of tree.byRound[size] ?? []) {
      for (const side of node.sides) {
        if (side.placeholder || !side.name) continue;
        const key = side.memCode || normSearch(side.name);
        const existing = byKey.get(key);
        const lostHere = node.decided && !side.won;
        if (!existing) {
          byKey.set(key, {
            name: side.name,
            memCode: side.memCode,
            quarter: node.quarter,
            deepestSize: size,
            latestRound: shortRoundLabel(size),
            eliminated: lostHere,
            nodeIds: new Set([node.id]),
          });
        } else {
          existing.nodeIds.add(node.id);
          if (node.quarter !== null && existing.quarter === null) existing.quarter = node.quarter;
          if (size < existing.deepestSize) {
            existing.deepestSize = size;
            existing.latestRound = shortRoundLabel(size);
          }
          if (lostHere) existing.eliminated = true;
        }
      }
    }
  }

  const hits: BracketPlayerHit[] = [];
  for (const [key, entry] of byKey) {
    let sectionId = tree.sections[0]?.id ?? "full";
    let sectionLabel = tree.sections[0]?.shortLabel ?? "Draw";
    if (tree.drawSize >= 128 && entry.quarter !== null) {
      sectionId = `q${entry.quarter + 1}`;
      sectionLabel = `Q${entry.quarter + 1}`;
    } else if (tree.drawSize === 64 && entry.quarter !== null) {
      sectionId = entry.quarter < 2 ? "top" : "bottom";
      sectionLabel = entry.quarter < 2 ? "Top" : "Bottom";
    }
    hits.push({
      key,
      name: entry.name,
      memCode: entry.memCode,
      sectionId,
      sectionLabel,
      latestRound: entry.latestRound,
      stillAlive: !entry.eliminated,
      nodeIds: [...entry.nodeIds],
    });
  }

  return hits.sort((a, b) => a.name.localeCompare(b.name));
}
