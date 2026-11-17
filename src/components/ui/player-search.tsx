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

/** Lowercase with every separator dropped, so "Ga-young", "Gayoung" and "ga young" agree. */
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
    // These datasets put the family name last, so "cho" should surface CHO
    // players ahead of someone whose given name merely starts with "Cho".
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
  // The shortcut fires on Ctrl too; the hint names the platform's actual key.
  // Server render assumes ⌘K and the effect corrects it after hydration.
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(/mac|iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The header survives client-side navigation, so a click elsewhere on the
  // page — a link out of the panel or the keyboard shortcut — has to reset it.
  useEffect(() => {
    setOpen(false);
    setTerm("");
  }, [pathname]);

  // The index is fetched once, on first focus, so it costs nothing until needed.
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

  // A panel only ever opens for a real query, so it must close the moment the
  // field loses its text or its focus. Otherwise it keeps covering the top of
  // whatever page was navigated to — which is exactly why a click on the first
  // event row under the header used to land on a search hit instead.
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
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
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
      if (open) event.stopPropagation();
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
    <div ref={containerRef} className={cn("relative", variant === "page" ? "w-full" : "w-full max-w-[320px]")}>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fog-600">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
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
          placeholder="Search players…"
          aria-label="Search players"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={showPanel ? "player-search-results" : undefined}
          aria-activedescendant={showPanel && results.length > 0 ? `player-search-option-${cursor}` : undefined}
          aria-autocomplete="list"
          className="field !py-1.5 !pl-8 !pr-14 text-[13px]"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-ink-650 bg-ink-800 px-1 py-0.5 font-sans text-[9.5px] font-semibold text-fog-600 lg:block">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </div>

      {showPanel && (
        <div
          id="player-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)]"
        >
          {loading && !rows ? (
            <p className="px-3 py-4 text-[12px] text-fog-500">Loading directory…</p>
          ) : results.length === 0 ? (
            <div className="px-3 py-4">
              <p className="text-[12.5px] text-fog-400">No player matches “{term}”.</p>
              <Link
                href={`/players?q=${encodeURIComponent(term)}`}
                onClick={() => setOpen(false)}
                className="mt-1.5 inline-block text-[12px] font-medium text-lime-400 hover:text-lime-300"
              >
                Browse the full directory →
              </Link>
            </div>
          ) : (
            <ul className="max-h-[min(336px,calc(100dvh-180px))] overflow-y-auto py-1">
              {results.map((row, index) => (
                <li key={row.c}>
                  <button
                    type="button"
                    role="option"
                    id={`player-search-option-${index}`}
                    aria-selected={index === cursor}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(row)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors",
                      index === cursor ? "bg-ink-800" : "hover:bg-ink-850",
                    )}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-750 font-display text-[10px] font-bold text-fog-400">
                      {(row.e || row.k).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fog-100">{row.e || row.k}</span>
                      {row.k && <span className="block truncate text-[10.5px] text-fog-600">{row.k}</span>}
                    </span>
                    <span className="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-fog-500">
                      {row.l}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-ink-800 px-3 py-1.5">
            <p className="text-[10px] text-fog-600">↑↓ to move · Enter to open · Esc to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
