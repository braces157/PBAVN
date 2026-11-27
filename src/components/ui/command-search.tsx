"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  ArrowRight,
  Calendar,
  GitCompareArrows,
  Newspaper,
  Radio,
  Search,
  Trophy,
  UserSearch,
  Users,
  BarChart3,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Button } from "./button";
import { Badge } from "./badge";

interface IndexRow {
  c: string;
  e: string;
  k: string;
  l: string;
  r?: number;
  n?: string;
}

const QUICK_ROUTES = [
  { href: "/live", label: "Live Arena", hint: "Real-time tables & scorecards", icon: Radio },
  { href: "/schedule", label: "Schedule", hint: "Daily matches & tour calendar", icon: Calendar },
  { href: "/players", label: "Player Directory", hint: "Browse 1,700+ pros by circuit & nation", icon: UserSearch },
  { href: "/rankings", label: "World Rankings", hint: "PBA, LPBA, World Champ & Q-School cutlines", icon: Trophy },
  { href: "/teams", label: "Team League", hint: "Club standings, rounds & fixtures", icon: Users },
  { href: "/compare", label: "Head-to-Head Compare", hint: "Compare any two pros side by side", icon: GitCompareArrows },
  { href: "/records", label: "Season Stats & Awards", hint: "Averages, high runs, Perfect Q & leaders", icon: BarChart3 },
  { href: "/news", label: "Newsroom", hint: "Press dispatches & galleries", icon: Newspaper },
];

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

function searchPlayers(rows: IndexRow[], query: string): IndexRow[] {
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
    .slice(0, 10)
    .map((x) => x.row);
}

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<IndexRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

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
      // ignore transient errors
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [rows]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !inField)) {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) void loadIndex();
    else setTerm("");
  }, [open, loadIndex]);

  const matches = useMemo(() => (rows ? searchPlayers(rows, term) : []), [rows, term]);

  const navigate = (href: string) => {
    setOpen(false);
    setTerm("");
    router.push(href);
  };

  return (
    <>
      {/* Desktop search trigger */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-[210px] justify-between px-3 text-xs font-normal text-muted-foreground sm:inline-flex xl:w-[240px]"
        aria-label="Search players"
      >
        <span className="inline-flex items-center gap-2">
          <Search className="size-3.5" />
          <span>Search players…</span>
        </span>
        <kbd className="mono pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border border-border bg-secondary px-1.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>

      {/* Mobile icon trigger */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className="sm:hidden"
        aria-label="Search players"
        title="Search players"
      >
        <Search className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0">
          <DialogTitle className="sr-only">Search PBA players and pages</DialogTitle>
          <DialogDescription className="sr-only">
            Type a player name in English or Korean, or jump to a section.
          </DialogDescription>
          <Command shouldFilter={false} className="flex flex-col overflow-hidden bg-popover text-popover-foreground">
            <div className="flex items-center gap-2.5 border-b border-border px-3.5">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Command.Input
                value={term}
                onValueChange={setTerm}
                placeholder="Search PBA & LPBA players (English or Korean)…"
                className="flex h-12 w-full bg-transparent text-sm text-foreground outline-none focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground"
              />
              <kbd className="mono hidden rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-[380px] overflow-y-auto p-2">
              {(/[가-힣]/.test(term) ? term.trim().length >= 1 : term.trim().length >= 2) ? (
                loading && !rows ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">Indexing player directory…</div>
                ) : matches.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">No players found for “{term}”.</p>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1"
                      onClick={() => navigate(`/players?q=${encodeURIComponent(term.trim())}`)}
                    >
                      Browse full directory <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Command.Group heading="Players" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                    {matches.map((row) => (
                      <Command.Item
                        key={row.c}
                        value={`${row.e} ${row.k} ${row.c}`}
                        onSelect={() => navigate(`/players/${row.c}`)}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="inline-grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
                            {(row.e || row.k).split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{row.e || row.k}</div>
                            {row.k && <div className="truncate text-xs text-muted-foreground">{row.k}</div>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {row.r && row.r > 0 ? (
                            <span className="mono text-[11px] font-medium text-muted-foreground">#{row.r}</span>
                          ) : null}
                          <Badge variant="outline" className="text-[10px]">
                            {row.l}
                          </Badge>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )
              ) : (
                <Command.Group heading="Quick Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                  {QUICK_ROUTES.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.href}
                        value={item.label}
                        onSelect={() => navigate(item.href)}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="size-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{item.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{item.hint}</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
