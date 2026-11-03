import Link from "next/link";

/** The PBA wordmark, rebuilt as vector so it stays crisp at every size. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-[10px] bg-lime-400 text-ink-950">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="2.1" fill="currentColor" />
          <circle cx="12" cy="5.4" r="1.15" fill="currentColor" />
          <circle cx="12" cy="18.6" r="1.15" fill="currentColor" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-extrabold tracking-[-0.02em] text-fog-100">
          PBA<span className="text-lime-400">.</span>
        </span>
        {!compact && (
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-fog-500">
            Billiards Association
          </span>
        )}
      </span>
    </span>
  );
}

export function LogoLink() {
  return (
    <Link href="/" aria-label="PBA Hub home" className="shrink-0">
      <span className="hidden sm:inline-flex">
        <Wordmark />
      </span>
      {/* A scoreboard header stays narrow on a phone: the mark alone is enough. */}
      <span className="inline-flex items-center sm:hidden">
        <span className="relative grid h-8 w-8 place-items-center rounded-[9px] bg-lime-400 text-ink-950">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
            <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="2.1" fill="currentColor" />
            <circle cx="12" cy="5.4" r="1.15" fill="currentColor" />
            <circle cx="12" cy="18.6" r="1.15" fill="currentColor" />
          </svg>
        </span>
      </span>
    </Link>
  );
}
