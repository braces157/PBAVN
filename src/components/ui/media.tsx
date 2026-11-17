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

function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-full w-full place-items-center bg-ink-850 font-display font-bold text-fog-300",
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
      className={cn(
        "grid h-full w-full place-items-center bg-ink-850",
        className,
      )}
      aria-hidden="true"
    >
      <span className="font-display text-[clamp(16px,2.8vw,28px)] font-extrabold tracking-[0.04em] text-fog-300">
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
        "relative inline-grid shrink-0 place-items-center overflow-hidden border border-[var(--hair)] bg-[var(--paper-2)] font-display font-bold text-[var(--ink)]",
        SIZES[size],
        ring && "ring-2 ring-[var(--ink)] ring-offset-1 ring-offset-[var(--paper)]",
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
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden border border-[var(--hair)] bg-[#fbfaf6] p-1",
        SIZES[size],
        className,
      )}
    >
      <SafeImage
        src={src}
        alt={name}
        className="h-full w-full object-contain"
        fallback={
          <span className="font-display text-[10px] font-bold text-fog-400" aria-hidden="true">
            {initials(name)}
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

const CREST_ACCENT: Record<string, string> = {
  lime: "bg-carom-400/12 text-carom-300 border-carom-400/35",
  rose: "bg-rose-450/12 text-rose-450 border-rose-450/35",
  cyan: "bg-cyan-450/12 text-cyan-450 border-cyan-450/35",
  amber: "bg-amber-450/12 text-amber-450 border-amber-450/35",
  violet: "bg-violet-450/12 text-violet-450 border-violet-450/35",
};

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
  const accent = CREST_ACCENT[entry?.tone ?? "lime"] ?? CREST_ACCENT.lime;
  const label = alt ?? name ?? tag;

  const fallback = (
    <span
      className={cn(
        "grid h-full w-full place-items-center rounded-[8px] border font-display font-extrabold tracking-[0.04em]",
        accent,
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
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-[8px] border border-ink-700 bg-ink-850 p-1",
        CREST_SIZES[size],
        className,
      )}
    >
      <SafeImage src={src} alt={label} className="h-full w-full object-contain" fallback={fallback} />
    </span>
  );
}

const COUNTRIES: Record<string, string> = {
  KOR: "Korea",
  VNM: "Vietnam",
  ESP: "Spain",
  BEL: "Belgium",
  TUR: "Turkey",
  NLD: "Netherlands",
  JPN: "Japan",
  GRE: "Greece",
  COL: "Colombia",
  ITA: "Italy",
  GER: "Germany",
  FRA: "France",
  USA: "United States",
  MEX: "Mexico",
  ECU: "Ecuador",
  EGY: "Egypt",
  AUT: "Austria",
  DEN: "Denmark",
  SWE: "Sweden",
  POR: "Portugal",
  PER: "Peru",
  CAM: "Cambodia",
  KHM: "Cambodia",
};

export function NationPlate({ code }: { code: string }) {
  const trimmed = (code || "").trim().toUpperCase();
  if (!trimmed) return null;
  const full = COUNTRIES[trimmed];
  return (
    <span
      title={full ?? trimmed}
      className="tnum inline-flex items-center border border-[var(--hair)] bg-[var(--paper-2)] px-1.5 py-[1px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink)]"
    >
      {trimmed}
    </span>
  );
}
