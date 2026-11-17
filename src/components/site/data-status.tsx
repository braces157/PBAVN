import { getRequestFailures } from "@/lib/pba/failures";
import { cn } from "@/components/ui/primitives";

export function DataStatus({
  failures: provided,
  className,
}: { failures?: string[]; className?: string } = {}) {
  const failures = provided ?? getRequestFailures();
  if (failures.length === 0) return null;

  return (
    <div
      role="status"
      className={cn(
        "mt-4 rounded-[6px] border border-gold-400/35 bg-gold-400/[0.08] px-3.5 py-2.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="inline-flex items-center gap-1.5 font-bold text-gold-300">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold-400" aria-hidden="true" />
          Partial data
        </span>
        <span className="text-fog-300">
          {failures.length === 1
            ? "One upstream feed did not respond, so part of this page may be missing."
            : `${failures.length} upstream feeds did not respond, so parts of this page may be missing.`}
        </span>
        <a
          href="https://www.pbatour.org/en/index"
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-gold-300 underline-offset-2 hover:underline"
        >
          Check pbatour.org ↗
        </a>
      </div>
    </div>
  );
}
