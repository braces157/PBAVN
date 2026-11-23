import { initials } from "@/lib/format";
import { eventArtUrl } from "@/lib/event-art";
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

import { flagClass } from "@/lib/flag";
export { flagClass };

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
        "grid h-full w-full place-items-center bg-secondary font-sans font-semibold text-muted-foreground",
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
      className={cn("grid h-full w-full place-items-center bg-secondary", className)}
      aria-hidden="true"
    >
      <span className="font-sans text-[clamp(16px,2.8vw,28px)] font-semibold tracking-wide text-muted-foreground">
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
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary font-sans font-semibold text-foreground",
        SIZES[size],
        ring && "ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background",
        className,
      )}
    >
      <Initials name={name} />
      <SafeImage
        path={path}
        src={src}
        width={PIXELS[size]}
        alt=""
        revealOnLoad
        className="absolute inset-0 h-full w-full object-cover object-top"
        fallback={null}
      />
    </span>
  );
}

export function TeamLogo({
  src,
  name,
  alt = "",
  size = "md",
  className,
}: {
  src?: string | null;
  name: string;
  alt?: string;
  size?: AvatarSize;
  className?: string;
}) {
  const badge = clubBadge(name);
  const resolved = src ? (eventArtUrl(src, PIXELS[size] * 2) ?? src) : null;
  if (!resolved) {
    return (
      <span
        className={cn("inline-grid shrink-0 place-items-center overflow-hidden rounded-lg", SIZES[size], className)}
        aria-hidden={alt === "" ? "true" : undefined}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      >
        <span className={cn("cr !h-full !w-full !rounded-none", badge.cls)} aria-hidden="true">
          {badge.code}
        </span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white p-1",
        SIZES[size],
        className,
      )}
    >
      <span className={cn("cr !h-full !w-full !rounded-md", badge.cls)} aria-hidden="true">
        {badge.code}
      </span>
      <SafeImage
        src={resolved}
        alt={alt}
        revealOnLoad
        className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] bg-white object-contain"
        fallback={null}
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
  league: string;
  name?: string;
  alt?: string;
  size?: keyof typeof CREST_SIZES;
  className?: string;
}) {
  const entry = LEAGUES.find((item) => item.code === league);
  const tag = entry?.tag ?? (league || "PBA");
  const label = alt ?? name ?? tag;
  const resolved = src ? (eventArtUrl(src, 128) ?? src) : null;

  const fallback = (
    <span
      className={cn(
        "grid h-full w-full place-items-center rounded-lg font-mono text-xs font-semibold tracking-wide text-white",
        leagueTagClass(league),
      )}
    >
      {tag}
    </span>
  );

  if (!resolved) {
    return (
      <span
        role="img"
        className={cn("inline-grid shrink-0 place-items-center overflow-hidden rounded-lg", CREST_SIZES[size], className)}
        aria-label={label}
      >
        {fallback}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900",
        CREST_SIZES[size],
        className,
      )}
    >
      {fallback}
      <SafeImage
        src={resolved}
        alt={alt ?? ""}
        revealOnLoad
        className="absolute inset-0 h-full w-full bg-zinc-900 object-contain p-1"
        fallback={null}
      />
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
