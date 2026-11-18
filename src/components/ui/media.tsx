import { initials } from "@/lib/format";
import { LEAGUES } from "@/lib/normalize";
import { SafeImage } from "./safe-image";
import { cn } from "./primitives";

const SIZES = {
  xs: "h-6 w-6 text-[9.5px]",
  sm: "h-8 w-8 text-[10.5px]",
  md: "h-11 w-11 text-xs",
  lg: "h-14 w-14 text-sm",
  xl: "h-20 w-20 text-lg",
  "2xl": "h-24 w-24 text-xl",
} as const;

const PIXELS = { xs: 24, sm: 32, md: 44, lg: 56, xl: 80, "2xl": 96 } as const;

export type AvatarSize = keyof typeof SIZES;

const ISO2_BY_CODE: Record<string, string> = {
  KOR: "kr",
  ESP: "es",
  VIE: "vn", VNM: "vn",
  TUR: "tr",
  BEL: "be",
  GRE: "gr", GRC: "gr",
  COL: "co",
  NED: "nl", NLD: "nl",
  JPN: "jp",
  AUT: "at",
  FRA: "fr",
  GER: "de", DEU: "de",
  USA: "us",
  DEN: "dk", DNK: "dk",
  EGY: "eg",
  ITA: "it",
  POR: "pt", PRT: "pt",
  SWE: "se",
  MEX: "mx",
  CHN: "cn",
  ECU: "ec",
  PER: "pe",
  CAM: "kh", KHM: "kh",
  GBR: "gb", UK: "gb",
  TPE: "tw", TWN: "tw",
  BRA: "br",
  ARG: "ar",
  SUI: "ch", CHE: "ch",
  POL: "pl",
  CZE: "cz",
  ROU: "ro",
  HUN: "hu",
  THA: "th",
  MAS: "my", MYS: "my",
  PHI: "ph", PHL: "ph",
  AUS: "au",
  CAN: "ca",
};

export function flagClass(nation: string | null | undefined): string {
  const key = (nation ?? "").trim().toUpperCase();
  if (!key || key === "—") return "f";
  const iso2 = ISO2_BY_CODE[key] ?? (/^[A-Z]{2}$/.test(key) ? key.toLowerCase() : null);
  return iso2 ? `f fi fi-${iso2}` : "f";
}

const CLUB_CRESTS: Record<string, { code: string; cls: string }> = {
  huons: { code: "HL", cls: "c1" },
  crown: { code: "CH", cls: "c2" },
  harim: { code: "HY", cls: "c3" },
  hana: { code: "HC", cls: "c4" },
  nh: { code: "NH", cls: "c5" },
  nonghyup: { code: "NH", cls: "c5" },
  woori: { code: "WF", cls: "c6" },
  sy: { code: "SY", cls: "c7" },
  welcome: { code: "WS", cls: "c8" },
  high1: { code: "H1", cls: "c9" },
  sk: { code: "SK", cls: "c10" },
  breakers: { code: "BR", cls: "c10" },
  blueone: { code: "BO", cls: "c9" },
  ts: { code: "TS", cls: "c7" },
};

const CREST_CLASSES = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10"];

export function clubBadge(name: string, index = 0): { code: string; cls: string } {
  const lower = name.toLowerCase();
  for (const [needle, badge] of Object.entries(CLUB_CRESTS)) {
    if (lower.includes(needle)) return badge;
  }
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return {
    code: letters || name.slice(0, 2).toUpperCase() || "TM",
    cls: CREST_CLASSES[index % CREST_CLASSES.length],
  };
}

export function leagueTagClass(league: string | null | undefined): string {
  const l = (league ?? "").trim().toUpperCase();
  if (l === "TLG" || l === "TEAM") return "t-team";
  if (l === "LPBA1" || l === "LPBA") return "t-lpba";
  if (l === "PBA2" || l === "DRM" || l === "DREAM") return "t-dream";
  return "t-pba";
}

function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-full w-full place-items-center bg-[var(--bar-2)] font-display font-bold text-[var(--text-2)]",
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function InitialsPlate({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn("grid h-full w-full place-items-center bg-[var(--bar-2)]", className)}
      aria-hidden="true"
    >
      <span className="font-display text-[clamp(16px,2.8vw,28px)] font-bold tracking-[0.04em] text-[var(--text-2)]">
        {initials(name)}
      </span>
    </div>
  );
}

export function PlayerAvatar({
  path,
  src,
  name,
  size = "md",
  className,
  ring = false,
}: {
  path?: string | null;
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-[3px] border border-[var(--line)] bg-[var(--bar-2)] font-display font-bold text-[var(--text)]",
        SIZES[size],
        ring && "ring-2 ring-[var(--yellow)] ring-offset-1 ring-offset-[var(--panel)]",
        className,
      )}
    >
      <SafeImage
        path={path}
        src={src}
        width={PIXELS[size]}
        alt=""
        className="h-full w-full object-cover object-top"
        fallback={<Initials name={name} />}
      />
    </span>
  );
}

export function TeamLogo({
  src,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
}) {
  const badge = clubBadge(name);
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-[3px] border border-[var(--line)] bg-[#ffffff] p-1",
        SIZES[size],
        className,
      )}
    >
      <SafeImage
        src={src}
        alt={name}
        className="h-full w-full object-contain"
        fallback={
          <span className={cn("cr", badge.cls)} aria-hidden="true">
            {badge.code}
          </span>
        }
      />
    </span>
  );
}

export function EventLogo({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  if (!src) return null;
  return (
    <span className={cn("inline-grid place-items-center", className)}>
      <SafeImage
        src={src}
        alt={name}
        className="max-h-full max-w-full object-contain"
        fallback={<span />}
      />
    </span>
  );
}

const CREST_SIZES = {
  sm: "h-9 w-9 text-[10px]",
  md: "h-11 w-11 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

export function EventCrest({
  src,
  league,
  name,
  alt,
  size = "md",
  className,
}: {
  src?: string | null;
  srcSet?: string;
  league: string;
  name?: string;
  alt?: string;
  size?: keyof typeof CREST_SIZES;
  className?: string;
}) {
  const entry = LEAGUES.find((item) => item.code === league);
  const tag = entry?.tag ?? (league || "PBA");
  const label = alt ?? name ?? tag;

  const fallback = (
    <span
      className={cn(
        "grid h-full w-full place-items-center rounded-[3px] font-display font-bold tracking-[0.04em] text-white",
        leagueTagClass(league),
      )}
    >
      {tag}
    </span>
  );

  if (!src) {
    return (
      <span className={cn("inline-grid shrink-0 place-items-center", CREST_SIZES[size], className)} aria-label={label}>
        {fallback}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-[3px] border border-[var(--line)] bg-[#ffffff] p-1",
        CREST_SIZES[size],
        className,
      )}
    >
      <SafeImage src={src} alt={label} className="h-full w-full object-contain" fallback={fallback} />
    </span>
  );
}

const COUNTRIES: Record<string, string> = {
  KOR: "Korea", KR: "Korea",
  VNM: "Vietnam", VN: "Vietnam", VIE: "Vietnam",
  ESP: "Spain", ES: "Spain",
  BEL: "Belgium", BE: "Belgium",
  TUR: "Turkey", TR: "Turkey",
  NLD: "Netherlands", NL: "Netherlands", NED: "Netherlands",
  JPN: "Japan", JP: "Japan",
  GRE: "Greece", GR: "Greece", GRC: "Greece",
  COL: "Colombia", CO: "Colombia",
  ITA: "Italy", IT: "Italy",
  GER: "Germany", DE: "Germany", DEU: "Germany",
  FRA: "France", FR: "France",
  USA: "United States", US: "United States",
  MEX: "Mexico", MX: "Mexico",
  ECU: "Ecuador", EC: "Ecuador",
  EGY: "Egypt", EG: "Egypt",
  AUT: "Austria", AT: "Austria",
  DEN: "Denmark", DK: "Denmark", DNK: "Denmark",
  SWE: "Sweden", SE: "Sweden",
  POR: "Portugal", PT: "Portugal", PRT: "Portugal",
  PER: "Peru", PE: "Peru",
  CAM: "Cambodia", KHM: "Cambodia", KH: "Cambodia",
  CHN: "China", CN: "China",
};

export function NationFlag({ code }: { code: string | null | undefined }) {
  const trimmed = (code || "").trim().toUpperCase();
  if (!trimmed || trimmed === "—") return null;
  return <i className={flagClass(trimmed)} title={COUNTRIES[trimmed] ?? trimmed} aria-hidden="true" />;
}

export function NationPlate({ code }: { code: string }) {
  const trimmed = (code || "").trim().toUpperCase();
  if (!trimmed || trimmed === "—") return null;
  const full = COUNTRIES[trimmed];
  return (
    <span
      title={full ?? trimmed}
      className="tnum inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--line)] bg-[var(--bar)] px-1.5 py-[1px] text-[10.5px] font-semibold uppercase tracking-[0.03em] text-[var(--text)]"
    >
      <i className={flagClass(trimmed)} aria-hidden="true" />
      <span>{trimmed}</span>
    </span>
  );
}
