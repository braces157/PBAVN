"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<IndexRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOpen(false);
    setTerm("");
  }, [pathname]);

  const load = useCallback(async () => {
    if (rows || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/search-index");
      if (response.ok) {
        const payload = (await response.json()) as { rows: IndexRow[] };
        setRows(payload.rows);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [rows, loading]);

  const results = useMemo(() => (rows ? search(rows, term) : []), [rows, term]);

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
  }, []);

  const go = (row: IndexRow) => {
    setOpen(false);
    setTerm("");
    router.push(`/players/${row.c}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => (value + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => (value - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const picked = results[cursor];
      if (picked) go(picked);
      else router.push(`/players?q=${encodeURIComponent(term)}`);
    }
  };

  const showPanel = open && term.trim().length >= 2;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        variant === "page" ? "w-full" : "w-[200px] xl:w-[230px]",
      )}
    >
      <label className="flex items-center gap-2 border-b-2 border-[var(--ink)] pb-1.5 pt-1 text-[14px] text-[var(--ink-3)] focus-within:border-[var(--red)]">
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="shrink-0 text-[var(--ink-2)]"
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
          }}
          onFocus={() => {
            setOpen(true);
            void load();
          }}
          onKeyDown={onKeyDown}
          placeholder="Player, team or event"
          aria-label="Search players"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="player-search-results"
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
        />
        <kbd className="hidden border border-[var(--hair)] px-1.5 py-0 text-[11px] text-[var(--ink-3)] lg:inline-block">
          /
        </kbd>
      </label>

      {showPanel && (
        <div
          id="player-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 border border-[var(--ink)] bg-[var(--paper)] shadow-lg"
        >
          {loading && !rows ? (
            <p className="px-3.5 py-4 text-[12.5px] text-[var(--ink-3)]">Indexing directory…</p>
          ) : results.length === 0 ? (
            <div className="px-3.5 py-4">
              <p className="text-[13px] text-[var(--ink-2)]">No player matches “{term}”.</p>
              <Link
                href={`/players?q=${encodeURIComponent(term)}`}
                onClick={() => setOpen(false)}
                className="mt-1.5 inline-block text-[12.5px] font-bold text-[var(--red)] hover:underline"
              >
                Search full directory →
              </Link>
            </div>
          ) : (
            <ul className="max-h-[336px] divide-y divide-[var(--hair)] overflow-y-auto">
              {results.map((row, index) => (
                <li key={row.c}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === cursor}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(row)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                      index === cursor ? "bg-[var(--paper-2)]" : "hover:bg-[var(--paper-2)]",
                    )}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center bg-[var(--ink)] font-bold text-[10px] text-[var(--paper)]">
                      {(row.e || row.k).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-[var(--ink)]">{row.e || row.k}</span>
                      {row.k && <span className="block truncate text-[11px] text-[var(--ink-3)]">{row.k}</span>}
                    </span>
                    <span className="shrink-0 border border-[var(--hair)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                      {row.l}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-[var(--hair)] bg-[var(--paper-2)] px-3 py-1.5">
            <p className="text-[11px] text-[var(--ink-3)]">↑↓ navigate · Enter open · Esc close</p>
          </div>
        </div>
      )}
    </div>
  );
}
