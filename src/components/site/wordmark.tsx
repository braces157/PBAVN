import Link from "next/link";

export function BrandEmblem({ size = 28 }: { size?: number }) {
  const svgSize = Math.round(size * 0.58);
  return (
    <span
      className="brand-emblem"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={svgSize} height={svgSize} viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="#3B82F6" strokeWidth="1.3" />
        <circle cx="5.5" cy="10" r="1.8" fill="#FFFFFF" />
        <circle cx="10.5" cy="10" r="1.8" fill="#F59E0B" />
        <circle cx="8" cy="5.5" r="1.8" fill="#E11D48" />
      </svg>
    </span>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-link">
      <BrandEmblem size={compact ? 24 : 28} />
      <span className="brand-word" style={compact ? { fontSize: 17 } : undefined}>
        PBA <span>HUB</span>
      </span>
    </span>
  );
}

export function LogoLink() {
  return (
    <Link href="/" aria-label="PBA Hub home" className="brand-link shrink-0 hover:no-underline">
      <span className="hidden sm:inline-flex">
        <Wordmark />
      </span>
      <span className="inline-flex sm:hidden">
        <Wordmark compact />
      </span>
    </Link>
  );
}
