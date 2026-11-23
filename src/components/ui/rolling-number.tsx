"use client";

import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

/**
 * Apple-style smooth rolling numeric display powered by `@number-flow/react`.
 * Mounts `<NumberFlow>` post-hydration so React 19 SSR never emits a custom-element mismatch.
 */
export function RollingNumber({
  value,
  className = "",
}: {
  value: number | string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || !mounted) {
    return <span className={`tabular-nums ${className}`}>{value}</span>;
  }
  return (
    <NumberFlow
      value={numeric}
      className={`tabular-nums ${className}`}
      transformTiming={{ duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      spinTiming={{ duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
    />
  );
}
