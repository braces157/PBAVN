"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "./primitives";

interface IndexRow {
  c: string;
  e: string;
  k: string;
  l: string;
}

const MAX_RESULTS = 7;

function squeeze(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9가-힣]/g, "");
}

interface Scored {
  row: IndexRow;
  score: number;
}

function search(rows: IndexRow[], term: string): IndexRow[] {
  const needle = squeeze(term);
  if (needle.length < 2) return [];
  const scored: Scored[] = [];

  for (const row of rows) {
    const en = squeeze(row.e);
    const ko = squeeze(row.k);
    const family = squeeze((row.e.split(/\s+/).pop() ?? "") || "");
    let score = 0;

    if (family === needle) score = 120;
    else if (family.startsWith(needle)) score = 110;
    else if (ko === needle) score = 115;
    else if (ko.startsWith(needle)) score = 105;
    else if (en.startsWith(needle)) score = 80;
    else if (en.includes(needle) || ko.includes(needle)) score = 50;
    else if (squeeze(row.c).startsWith(needle)) score = 40;

    if (score > 0) scored.push({ row, score: score - Math.min(row.e.length, 40) * 0.1 });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.row.e.localeCompare(b.row.e))
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.row);
}

export function PlayerSearch({ variant = "header" }: { variant?: "header" | "page" }) {
  const router = useRouter();
  const pathname = usePathname();
  const baseId = useId();
  const listId = `${baseId}-results`;
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<IndexRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [cursor, setCursor] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setOpen(false);
    setTerm("");
  }, [pathname]);

  useEffect(() => {
    return () => {
      inFlightRef.current?.abort();
    };
  }, []);

  const load = useCallback(async () => {
    if (rows !== null || inFlightRef.current) return;
    const controller = new AbortController();
    inFlightRef.current = controller;
    setLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetch("/api/search-index", { signal: controller.signal });
      if (response.ok) {
        const payload = (await response.json()) as { rows?: IndexRow[] };
        if (Array.isArray(payload.rows) && payload.rows.length > 0) {
          setRows(payload.rows);
        } else {
          setLoadFailed(true);
        }
      } else {
        setLoadFailed(true);
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setLoadFailed(true);
      }
    } finally {
      if (inFlightRef.current === controller) {
        inFlightRef.current = null;
      }
      setLoading(false);
    }
  }, [rows]);

  const results = useMemo(() => (rows ? search(rows, term) : []), [rows, term]);
  const safeCursor = results.length > 0 ? Math.min(cursor, results.length - 1) : 0;

  useEffect(() => {
    setCursor(0);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  useEffect(() => {
    if (variant !== "header") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !inField)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant]);

  const go = (row: IndexRow) => {
    setOpen(false);
    setTerm("");
    router.push(`/players/${row.c}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (event.key === "Enter") {
      const trimmed = term.trim();
      if (!trimmed) return;
      event.preventDefault();
      const picked = results[safeCursor];
      if (picked) {
        go(picked);
      } else {
        setOpen(false);
        router.push(`/players?q=${encodeURIComponent(trimmed)}`);
      }
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => (value + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => (value - 1 + results.length) % results.length);
    }
  };

  const showPanel = open && term.trim().length >= 2;
  const isHeader = variant === "header";

  return (
    <div
      ref={containerRef}
      className={cn("relative", isHeader ? "min-w-0 flex-1 lg:flex-none" : "w-full")}
    >
      <label
        className={
          isHeader
            ? "srch"
            : "flex items-center gap-2 rounded-[3px] border border-[var(--line-2)] bg-[var(--panel)] px-2.5 py-1.5 text-[13px] text-[var(--muted)] focus-within:border-[var(--link)]"
        }
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="shrink-0 opacity-75"
        >
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m11 11 4 4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
            if (rows === null && !loading) void load();
          }}
          onFocus={() => {
            setOpen(true);
            void load();
          }}
          onKeyDown={onKeyDown}
          placeholder="Search players"
          aria-label="Search players"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={showPanel && results.length > 0 ? listId : undefined}
          aria-activedescendant={
            showPanel && results.length > 0 ? `${baseId}-option-${safeCursor}` : undefined
          }
          aria-autocomplete="list"
          className={cn(
            "min-w-0 flex-1 bg-transparent outline-none",
            isHeader
              ? "text-[12.5px] text-white placeholder:text-[#98a6b3]"
              : "text-[13px] text-[var(--text)] placeholder:text-[var(--muted)]",
          )}
        />
        <kbd className={isHeader ? "hidden sm:inline-block" : "hidden"}>/</kbd>
      </label>

      {showPanel && (
        <div
          className="absolute right-0 top-[calc(100%+4px)] z-50 w-[min(280px,calc(100vw-16px))] rounded-[3px] border border-[var(--line-2)] bg-[var(--panel)] text-[var(--text)] shadow-lg sm:left-0 sm:right-0 sm:w-auto sm:min-w-[270px]"
        >
          <span className="sr-only" role="status" aria-live="polite">
            {loading && !rows
              ? "Indexing player directory"
              : loadFailed
                ? "Player directory unavailable"
                : results.length === 0
                  ? `No players matching ${term}`
                  : `${results.length} matching players`}
          </span>
          {loading && !rows ? (
            <p className="px-3 py-3 text-[12px] text-[var(--muted)]">Indexing directory…</p>
          ) : loadFailed && !rows ? (
            <div className="px-3 py-3">
              <p className="text-[12.5px] text-[var(--text-2)]">Quick search is temporarily unavailable.</p>
              <Link
                href={`/players?q=${encodeURIComponent(term.trim())}`}
                onClick={() => setOpen(false)}
                className="mt-1 inline-block text-[12px] font-semibold text-[var(--link)] hover:underline"
              >
                Search full directory →
              </Link>
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3">
              <p className="text-[12.5px] text-[var(--text-2)]">No player matches “{term}”.</p>
              <Link
                href={`/players?q=${encodeURIComponent(term.trim())}`}
                onClick={() => setOpen(false)}
                className="mt-1 inline-block text-[12px] font-semibold text-[var(--link)] hover:underline"
              >
                Search full directory →
              </Link>
            </div>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="Matching players"
              className="max-h-[320px] divide-y divide-[var(--line)] overflow-y-auto"
            >
              {results.map((row, index) => (
                <li
                  key={row.c}
                  id={`${baseId}-option-${index}`}
                  role="option"
                  aria-selected={index === safeCursor}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(row)}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors",
                      index === safeCursor ? "bg-[var(--hover)]" : "hover:bg-[var(--hover)]",
                    )}
                  >
                    <span className="av shrink-0" aria-hidden="true">
                      {(row.e || row.k).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">
                        {row.e || row.k}
                      </span>
                      {row.k && <span className="block truncate text-[11px] text-[var(--muted)]">{row.k}</span>}
                    </span>
                    <span
                      className={cn(
                        "tag shrink-0",
                        row.l === "LPBA1" ? "t-lpba" : row.l === "PBA2" ? "t-dream" : "t-pba",
                      )}
                    >
                      {row.l}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-[var(--line)] bg-[var(--bar)] px-2.5 py-1.5">
            <p className="text-[11px] text-[var(--muted)]">↑↓ navigate · Enter open · Esc close</p>
          </div>
        </div>
      )}
    </div>
  );
}
