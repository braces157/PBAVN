import { leagueShort } from "@/lib/normalize";

const TAG_TONE: Record<string, string> = {
  TLG: "text-violet-450",
  LPBA: "text-rose-450",
  PBA: "text-carom-400",
  DRM: "text-cyan-450",
  CHL: "text-amber-450",
};

export function leagueTagTone(code: string | null | undefined): string {
  return TAG_TONE[leagueShort(code)] ?? "text-fog-500";
}
