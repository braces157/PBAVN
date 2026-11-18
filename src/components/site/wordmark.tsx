import Link from "next/link";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <span className="mk" aria-hidden="true">
        <i style={{ background: "#fbfaf6" }} />
        <i style={{ background: "var(--yellow)" }} />
        <i style={{ background: "#d6322a" }} />
      </span>
      <span className={compact ? "text-[16px]" : undefined}>
        PBA<b>HUB</b>
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
      <span className="inline-flex sm:hidden">
        <Wordmark compact />
      </span>
    </Link>
  );
}
