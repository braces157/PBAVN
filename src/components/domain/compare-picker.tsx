"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface IndexRow {
  c: string;
  e: string;
  k: string;
  l: string;
  r?: number;
  n?: string;
}

const TIER_BONUS: Record<string, number> = {
  PBA1: 28,
  LPBA1: 26,
  PBA2: 10,
  PBA3: 4,
};

function squeeze(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .replace(/[^a-z0-9가-힣]/g, "");
}

function rankMatches(rows: IndexRow[], query: string): IndexRow[] {
  const needle = squeeze(query);
  const isHangul = /[가-힣]/.test(needle);
  if (needle.length < (isHangul ? 1 : 2)) return [];
  const scored: { row: IndexRow; score: number }[] = [];
  for (const row of rows) {
    const en = squeeze(row.e);
    const ko = squeeze(row.k);
    const family = squeeze((row.e.split(/\s+/).pop() ?? "") || "");
    let score = 0;
    if (ko === needle) score = 140;
    else if (family === needle) score = 120;
    else if (ko.startsWith(needle)) score = 115;
    else if (family.startsWith(needle)) score = 110;
    else if (en === needle) score = 135;
    else if (en.startsWith(needle)) score = 95;
    else if (en.includes(needle) || ko.includes(needle)) score = 60;
    else if (squeeze(row.c).startsWith(needle)) score = 45;
    if (score > 0) {
      const tier = TIER_BONUS[row.l] ?? 0;
      const rankBoost = row.r && row.r > 0 ? Math.max(0, 32 - Math.log2(row.r + 1) * 5.2) : 0;
      scored.push({ row, score: score + tier + rankBoost - Math.min(row.e.length, 40) * 0.05 });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || (a.row.r || 9999) - (b.row.r || 9999) || a.row.e.localeCompare(b.row.e))
    .slice(0, 8)
    .map((x) => x.row);
}

interface PickerValue {
  code: string;
  label: string;
}

function PlayerAutocomplete({
  id,
  placeholder,
  ariaLabel,
  value,
  rows,
  loading,
  onFocusLoad,
  onChange,
}: {
  id: string;
  placeholder: string;
  ariaLabel: string;
  value: PickerValue;
  rows: IndexRow[] | null;
  loading: boolean;
  onFocusLoad: () => void;
  onChange: (next: PickerValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(
    () => (rows && !value.code ? rankMatches(rows, value.label) : rows ? rankMatches(rows, value.label) : []),
    [rows, value.label, value.code],
  );

  useEffect(() => {
    setCursor(0);
  }, [value.label]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const showDropdown =
    open && (/[가-힣]/.test(value.label) ? value.label.trim().length >= 1 : value.label.trim().length >= 2);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
        <input
          id={id}
          type="text"
          value={value.label}
          autoComplete="off"
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          onFocus={() => {
            onFocusLoad();
            setOpen(true);
          }}
          onChange={(e) => {
            onFocusLoad();
            setOpen(true);
            onChange({ code: "", label: e.target.value });
          }}
          onKeyDown={(e) => {
            if (!showDropdown || matches.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => (c + 1) % matches.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => (c - 1 + matches.length) % matches.length);
            } else if (e.key === "Enter" && !value.code) {
              const picked = matches[cursor];
              if (picked) {
                e.preventDefault();
                onChange({ code: picked.c, label: picked.e || picked.k });
                setOpen(false);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {value.label && (
          <button
            type="button"
            onClick={() => onChange({ code: "", label: "" })}
            aria-label={`Clear ${ariaLabel}`}
            className="absolute right-2 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {loading && !rows ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">Loading player directory…</p>
          ) : matches.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">No matching player found.</p>
          ) : (
            <ul role="listbox" className="max-h-64 divide-y divide-border/50 overflow-y-auto py-1">
              {matches.map((row, idx) => (
                <li key={row.c} role="option" aria-selected={idx === cursor}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange({ code: row.c, label: row.e || row.k });
                      setOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                      idx === cursor ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{row.e || row.k}</span>
                      {row.k && <span className="block truncate text-[11px] text-muted-foreground">{row.k}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {row.r && row.r > 0 ? (
                        <span className="mono text-[10.5px] text-muted-foreground">#{row.r}</span>
                      ) : null}
                      <Badge variant="outline" className="text-[10px]">
                        {row.l}
                      </Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ComparePicker({
  initialA,
  initialB,
  seasonParam,
}: {
  initialA: PickerValue;
  initialB: PickerValue;
  seasonParam?: string;
}) {
  const router = useRouter();
  const [p1, setP1] = useState<PickerValue>(initialA);
  const [p2, setP2] = useState<PickerValue>(initialB);
  const [rows, setRows] = useState<IndexRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setP1(initialA);
  }, [initialA.code, initialA.label]);

  useEffect(() => {
    setP2(initialB);
  }, [initialB.code, initialB.label]);

  const loadIndex = useCallback(async () => {
    if (rows !== null || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/search-index");
      if (res.ok) {
        const data = (await res.json()) as { rows?: IndexRow[] };
        if (Array.isArray(data.rows)) setRows(data.rows);
      }
    } catch {
      // ignore transient error
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [rows]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (seasonParam) params.set("season", seasonParam);
    const code1 = p1.code || (rows && p1.label.trim() ? rankMatches(rows, p1.label)[0]?.c ?? "" : "");
    const code2 = p2.code || (rows && p2.label.trim() ? rankMatches(rows, p2.label)[0]?.c ?? "" : "");
    if (code1) params.set("a", code1);
    else if (p1.label.trim()) params.set("q1", p1.label.trim());
    if (code2) params.set("b", code2);
    else if (p2.label.trim()) params.set("q2", p2.label.trim());
    router.push(`/compare${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const swap = () => {
    setP1(p2);
    setP2(p1);
  };

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
      <PlayerAutocomplete
        id="compare-p1"
        placeholder="Player one (English or Korean)…"
        ariaLabel="First player"
        value={p1}
        rows={rows}
        loading={loading}
        onFocusLoad={() => void loadIndex()}
        onChange={setP1}
      />
      <button
        type="button"
        onClick={swap}
        title="Swap players"
        aria-label="Swap players"
        className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
      >
        <ArrowLeftRight className="size-3.5" />
      </button>
      <PlayerAutocomplete
        id="compare-p2"
        placeholder="Player two (English or Korean)…"
        ariaLabel="Second player"
        value={p2}
        rows={rows}
        loading={loading}
        onFocusLoad={() => void loadIndex()}
        onChange={setP2}
      />
      <button
        type="submit"
        className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Compare
      </button>
    </form>
  );
}
