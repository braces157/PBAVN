import { getRequestFailures } from "@/lib/pba/failures";

/**
 * Shown when the association's service did not answer for this request.
 *
 * Without this, a timeout renders identically to "no data exists", which is the
 * difference between an honest empty table and the site quietly lying.
 */
export function DataStatus({ failures: provided }: { failures?: string[] } = {}) {
  const failures = provided ?? getRequestFailures();
  if (failures.length === 0) return null;

  return (
    <div
      role="status"
      className="mt-6 rounded-[12px] border border-amber-450/30 bg-amber-450/[0.07] px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-450">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-450" aria-hidden="true" />
          Partial data
        </span>
        <span className="text-fog-400">
          {failures.length === 1
            ? "One feed did not respond, so part of this page may be missing."
            : `${failures.length} feeds did not respond, so parts of this page may be missing.`}{" "}
          What is shown is real; what is absent may simply be unreachable.
        </span>
        <a
          href="https://www.pbatour.org/en/index"
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-amber-450 underline-offset-2 hover:underline"
        >
          Check pbatour.org ↗
        </a>
      </div>
    </div>
  );
}
