/**
 * Shared vocabulary for the scoreboard rows.
 *
 * The row *shape* lives with the thing it lists (`bracket-view` for a draw,
 * `fixture-board` for a team-league round) because each reads a different feed.
 * What they share is the gutter: a two-to-four letter circuit tag, in the
 * circuit's own colour, in the same 42 px column on every list — the thing that
 * lets a reader tell a PBA row from an LPBA row from a team-league row without
 * reading the title.
 *
 * The circuit tags themselves live with league identity in `lib/normalize`.
 */

import { leagueShort } from "@/lib/normalize";

const TAG_TONE: Record<string, string> = {
  TLG: "text-violet-450",
  LPBA: "text-rose-450",
  PBA: "text-lime-400",
  DRM: "text-cyan-450",
  CHL: "text-amber-450",
};

/** Tailwind text colour for a league code's tag. */
export function leagueTagTone(code: string | null | undefined): string {
  return TAG_TONE[leagueShort(code)] ?? "text-fog-550";
}
