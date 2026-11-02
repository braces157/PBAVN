import { initials } from "@/lib/format";
import { SafeImage } from "./safe-image";
import { cn } from "./primitives";

const SIZES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-[11px]",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-xl",
  "2xl": "h-32 w-32 text-2xl",
} as const;

/** The rendered width of each size, so the proxy can resize to it instead of the browser. */
const PIXELS = { xs: 28, sm: 36, md: 48, lg: 64, xl: 96, "2xl": 128 } as const;

export type AvatarSize = keyof typeof SIZES;

function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-full w-full place-items-center bg-ink-750 font-display font-bold text-fog-400",
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/**
 * The stand-in for a player with no photo on file — roughly half the directory.
 * A flat empty rectangle reads as a broken image, so this plate is deliberately
 * designed: a soft baize gradient, a faint billiard-cloth grid and the initials
 * set in the display face. It should look like a choice, not a failure.
 */
export function InitialsPlate({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br from-ink-700 via-ink-800 to-ink-900",
        className,
      )}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 28% 18%, rgba(212,255,74,0.10), transparent 55%), repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 7px)",
        }}
      />
      <span className="relative font-display text-[clamp(15px,3.2vw,30px)] font-bold tracking-[0.02em] text-fog-400">
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
  /** Raw upstream photo path — resized from the big copy by `/api/photo`. */
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
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-ink-750 font-display font-bold text-fog-400",
        SIZES[size],
        ring && "ring-2 ring-lime-400/40 ring-offset-2 ring-offset-ink-950",
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
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-800 p-1.5",
        SIZES[size],
        className,
      )}
    >
      <SafeImage
        src={src}
        alt={name}
        className="h-full w-full object-contain"
        fallback={
          <span className="font-display text-[11px] font-bold text-fog-500" aria-hidden="true">
            {initials(name)}
          </span>
        }
      />
    </span>
  );
}

/** Tournament / sponsor artwork, which arrives on an opaque plate. */
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

/** Country is shown as a code plate rather than a flag: upstream ships no flag art. */
export function NationPlate({ code, className }: { code: string; className?: string }) {
  const normalised = (code || "").trim().toUpperCase().slice(0, 3);
  if (!normalised || normalised === "—") return null;
  return (
    <span
      className={cn(
        "tnum inline-grid h-[18px] min-w-[26px] place-items-center rounded border border-ink-650 bg-ink-800 px-1 text-[9.5px] font-bold tracking-[0.06em] text-fog-400",
        className,
      )}
      title={normalised}
    >
      {normalised}
    </span>
  );
}
