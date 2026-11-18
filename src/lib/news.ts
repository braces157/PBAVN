export function detectNewsCategory(title: string): { label: string; cls: string } {
  const lower = title.toLowerCase();
  if (lower.includes("팀리그") || lower.includes("team league") || lower.includes("team")) {
    return { label: "Team League", cls: "t-team" };
  }
  if (lower.includes("lpba")) {
    return { label: "LPBA", cls: "t-lpba" };
  }
  if (lower.includes("드림") || lower.includes("dream")) {
    return { label: "Dream Tour", cls: "t-dream" };
  }
  return { label: "PBA", cls: "t-pba" };
}

export function splitNewsHeadline(rawTitle: string): {
  tag: { label: string; cls: string };
  kicker: string | null;
  headline: string;
} {
  const normalized = rawTitle.replace(/\s+/g, " ").trim();
  const tag = detectNewsCategory(normalized);
  const bracketMatch = normalized.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (bracketMatch) {
    const bracket = bracketMatch[1].trim();
    const rest = bracketMatch[2].trim();
    return {
      tag,
      kicker: bracket || null,
      headline: rest || normalized,
    };
  }
  return { tag, kicker: null, headline: normalized };
}
