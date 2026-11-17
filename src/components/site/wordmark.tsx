import Link from "next/link";

export function Wordmark({
  compact = false,
  inverse = false,
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex shrink-0 items-center gap-[3px]" aria-hidden="true">
        <i className="ball w lg" />
        <i className="ball y lg" />
        <i className="ball r lg" />
      </span>
      <span
        className={`x tracking-[-0.01em] ${compact ? "text-[32px]" : "text-[36px] sm:text-[40px]"} ${
          inverse ? "text-[#f3efe6]" : "text-[var(--ink)]"
        }`}
      >
        PBA<span className="text-[var(--red)]">Hub</span>
      </span>
    </span>
  );
}

export function LogoLink() {
  return (
    <Link href="/" aria-label="PBA Hub home" className="shrink-0 hover:no-underline">
      <span className="hidden sm:inline-flex">
        <Wordmark />
      </span>
      <span className="inline-flex items-center sm:hidden">
        <Wordmark compact />
      </span>
    </Link>
  );
}
