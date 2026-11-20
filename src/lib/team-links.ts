/**
 * Pure matching helpers that link Team League fixture names (clubs and short
 * player names from `team.pbatour.org`) back to canonical team codes and
 * player `MemCode`s.
 *
 * Kept free of runtime imports so `scripts/test-parsers.mjs` can execute it
 * directly under Node's `--experimental-strip-types`.
 */

export interface TeamRef {
  code: string;
  name: string;
  shortName: string;
}

export interface RosterEntry {
  code: string;
  name: string;
  nameEn?: string;
  rawKo?: string;
  average?: number;
  winRate?: number;
  highRun?: number;
}

export function extractClubCodeFromLogo(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  const match = logoUrl.match(/\/(T\d{4,6})(?:[._-]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

function normKey(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

export function matchTeamByNameOrLogo<T extends TeamRef>(
  teams: T[],
  name: string,
  logo: string | null | undefined,
): T | null {
  const logoCode = extractClubCodeFromLogo(logo);
  if (logoCode) {
    const byCode = teams.find((team) => team.code.toUpperCase() === logoCode);
    if (byCode) return byCode;
  }

  const target = normKey(name);
  if (!target) return null;

  const exact = teams.find(
    (team) => normKey(team.name) === target || normKey(team.shortName) === target,
  );
  if (exact) return exact;

  const partial = teams.find((team) => {
    const full = normKey(team.name);
    const short = normKey(team.shortName);
    return (
      (full && (full.includes(target) || target.includes(full))) ||
      (short && (short.includes(target) || target.includes(short)))
    );
  });
  return partial ?? null;
}

function splitLatinName(fullName: string): { family: string; givenParts: string[] } | null {
  const tokens = fullName
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/\.+$/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) return { family: tokens[0].toLowerCase(), givenParts: [] };

  const family = tokens[tokens.length - 1].toLowerCase();
  const givenParts = tokens
    .slice(0, -1)
    .flatMap((t) => t.split("-"))
    .map((t) => t.replace(/[^a-z]/gi, "").toLowerCase())
    .filter(Boolean);
  return { family, givenParts };
}

export function matchRosterPlayer(shortName: string, roster: RosterEntry[]): RosterEntry | null {
  const cleaned = shortName.trim();
  if (!cleaned || roster.length === 0) return null;

  const lower = cleaned.toLowerCase();
  const exact = roster.find(
    (p) =>
      p.name.trim().toLowerCase() === lower ||
      (p.nameEn && p.nameEn.trim().toLowerCase() === lower) ||
      (p.rawKo && p.rawKo.trim().toLowerCase() === lower),
  );
  if (exact) return exact;

  const parsed = splitLatinName(cleaned);
  if (!parsed) return null;

  const { family, givenParts } = parsed;
  const prefix = givenParts.join("");

  const familyMatches = roster.filter((player) => {
    const candidate = splitLatinName(player.nameEn || player.name);
    if (!candidate) return false;
    return candidate.family === family;
  });

  if (familyMatches.length === 0) return null;
  if (!prefix) return familyMatches.length === 1 ? familyMatches[0] : null;

  const initialMatches = familyMatches.filter((player) => {
    const candidate = splitLatinName(player.nameEn || player.name);
    if (!candidate || candidate.givenParts.length === 0) return false;
    const allInitials = candidate.givenParts.map((part) => part[0]).join("");
    const firstInitial = candidate.givenParts[0][0];
    const firstPart = candidate.givenParts[0];
    return prefix === allInitials || prefix === firstInitial || firstPart.startsWith(prefix);
  });

  if (initialMatches.length === 1) return initialMatches[0];
  // Never disambiguate a single-letter initial (e.g. "J. Kim" matching both
  // "Jae Ho Kim" and "Jun Kim") by picking the shorter full-initials player.
  if (prefix.length <= 1) return null;

  // For multi-letter prefixes (e.g. "PL"), prefer exact full initials.
  const exactInitials = initialMatches.filter((player) => {
    const candidate = splitLatinName(player.nameEn || player.name);
    if (!candidate) return false;
    return candidate.givenParts.map((part) => part[0]).join("") === prefix;
  });
  return exactInitials.length === 1 ? exactInitials[0] : null;
}
