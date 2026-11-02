import type { PbaDate } from "./pba/types";

/** Anything date-shaped the API or our own models can hand us. */
export type DateLike = PbaDate | Date;

/* ------------------------------------------------------------------- dates */

export function toDate(value: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && "year" in value && "monthValue" in value) {
    return new Date(value.year, value.monthValue - 1, value.dayOfMonth ?? 1, 12, 0, 0);
  }
  return null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(value: DateLike, withYear = true): string {
  const date = toDate(value);
  if (!date) return "—";
  const base = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return withYear ? `${base}, ${date.getFullYear()}` : base;
}

export function fmtDateShort(value: DateLike): string {
  const date = toDate(value);
  if (!date) return "—";
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "31 Oct – 8 Nov 2026", collapsing the year when both ends share it. */
export function fmtRange(start: DateLike, end: DateLike): string {
  const a = toDate(start);
  const b = toDate(end);
  if (!a && !b) return "Dates to be announced";
  if (!a) return fmtDate(end);
  if (!b) return fmtDate(start);
  if (a.getTime() === b.getTime()) return fmtDate(a);
  if (a.getFullYear() === b.getFullYear()) {
    return `${fmtDateShort(a)} – ${fmtDate(b)}`;
  }
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}

/** Local midnight copy — never mutates the caller's Date. */
function atMidnight(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function dayCount(start: DateLike, end: DateLike): number | null {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return null;
  return Math.round((atMidnight(b).getTime() - atMidnight(a).getTime()) / 86_400_000) + 1;
}

export function daysUntil(value: DateLike): number | null {
  const date = toDate(value);
  if (!date) return null;
  return Math.round((atMidnight(date).getTime() - atMidnight(new Date()).getTime()) / 86_400_000);
}

/* ------------------------------------------------------------------ numbers */

/**
 * Parse a number, or `null` when the text was never one.
 *
 * `Number("")` is 0, so a placeholder like "tbd" would otherwise read as a real
 * zero and be printed as one. Use this at the display edge; use `num` when a
 * zero default is genuinely wanted for arithmetic.
 */
export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const digits = String(value).replace(/[^0-9.-]/g, "");
  if (digits === "" || digits === "-" || digits === ".") return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

export function num(value: number | string | null | undefined, fallback = 0): number {
  return toNumber(value) ?? fallback;
}

export function int(value: number | string | null | undefined, fallback = 0): number {
  return Math.round(num(value, fallback));
}

/** Compact prize wording for dense UI: ₩216M, ₩111.5M, ₩150K. */
export function wonCompact(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (!n) return "—";
  const trim = (input: string) => input.replace(/\.0$/, "");
  if (n >= 1_000_000_000) return `₩${trim((n / 1_000_000_000).toFixed(1))}B`;
  if (n >= 1_000_000) return `₩${trim((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `₩${trim((n / 1_000).toFixed(0))}K`;
  return `₩${n}`;
}

/** 216000000 → "₩216,000,000" for tables. */
export function won(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (!n) return "—";
  return `₩${Math.round(n).toLocaleString("en-US")}`;
}

/** Compact Korean prize wording: ₩2.16억 / ₩1,150만. */
export function wonKorean(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (!n) return "—";
  if (n >= 100_000_000) {
    const eok = n / 100_000_000;
    return `₩${eok % 1 === 0 ? eok.toFixed(0) : eok.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}억`;
  }
  if (n >= 10_000) return `₩${Math.round(n / 10_000).toLocaleString("en-US")}만`;
  return `₩${n.toLocaleString("en-US")}`;
}

export function grouped(value: number | string | null | undefined): string {
  const n = toNumber(value);
  // A count that was never published is not zero.
  if (n === null) return "—";
  return n.toLocaleString("en-US");
}

/** Carom average, always three decimals — the sport's canonical precision. */
export function average(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (!n) return "—";
  return n.toFixed(3);
}

export function percent(value: number | string | null | undefined, digits = 1): string {
  const n = toNumber(value);
  if (!n) return "—";
  return `${n.toFixed(digits)}%`;
}

export function ordinal(value: number | string | null | undefined): string {
  const n = int(value);
  if (!n) return "—";
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/* -------------------------------------------------------------------- text */

export function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  return /^(tbd|tba|n\/a|null|undefined|-|—|미정|없음|추후|0)$/i.test(value.trim());
}

/** Upstream duplicates every label in EN and KO; prefer EN, fall back gracefully. */
export function pick(en: string | null | undefined, ko: string | null | undefined): string {
  const english = (en ?? "").trim();
  if (!isPlaceholder(english)) return english;
  const korean = (ko ?? "").trim();
  if (!isPlaceholder(korean)) return korean;
  return "—";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Kyong-min KANG" → "K. KANG" for narrow columns. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

export function stripTags(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerpt(html: string | null | undefined, length = 180): string {
  const text = stripTags(html);
  if (text.length <= length) return text;
  return `${text.slice(0, length).replace(/\s+\S*$/, "")}…`;
}

/** YouTube watch/short/embed URLs → embed URL, or null when it is not YouTube. */
export function youtubeEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{6,})/,
    /(?:youtu\.be\/)([\w-]{6,})/,
    /(?:youtube\.com\/embed\/)([\w-]{6,})/,
    /(?:youtube\.com\/shorts\/)([\w-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}

export function youtubeId(url: string | null | undefined): string | null {
  const embed = youtubeEmbed(url);
  return embed ? embed.split("/").pop() ?? null : null;
}
