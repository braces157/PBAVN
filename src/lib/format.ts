import type { PbaDate } from "./pba/types";

/** Anything date-shaped the API or our own models can hand us. */
export type DateLike = PbaDate | Date;

/* ------------------------------------------------------------------- dates */

export function toDate(value: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    // A date-only key is a calendar day, not a UTC instant: `new Date` would
    // read it as UTC midnight and push a host west of UTC to the previous day.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseIsoDay(value);
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

/* ------------------------------------------------------------ calendar rails */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Monday-first, which is how a European tour calendar is read. */
const WEEKDAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The first day of the week containing `value`, Monday. */
export function startOfWeek(value: DateLike): Date | null {
  const date = toDate(value);
  if (!date) return null;
  const monday = atMidnight(date);
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday;
}

/** Index of a day within its Monday-first week: 0 = Monday. */
export function weekIndex(value: DateLike): number {
  const date = toDate(value);
  if (!date) return 0;
  return (date.getDay() + 6) % 7;
}

/** "Mon" … "Sun", Monday first, for a day key. */
export function weekdayMon(value: DateLike): string {
  const date = toDate(value);
  if (!date) return "—";
  return WEEKDAYS_MON[weekIndex(date)];
}

/** `2026-10-20`, in local time, as the rail's stable key. */
export function isoDay(value: DateLike): string | null {
  const date = toDate(value);
  if (!date) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A `YYYY-MM-DD` string read back as local midnight, or null. */
export function parseIsoDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/** Midnight today — the anchor every "today" test uses. */
export function startOfToday(now = new Date()): Date {
  return atMidnight(now);
}

/** The calendar date in Korea, the clock the association schedules on. A UTC
 * server would otherwise open "today" nine hours early. */
export function kstDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Shift a day key by whole days, staying on local midnight across DST. */
export function shiftIsoDay(day: string, days: number): string {
  const base = parseIsoDay(day) ?? atMidnight(new Date());
  base.setDate(base.getDate() + days);
  return isoDay(base) as string;
}

/** "Tue" / "Tuesday" for a day key. */
export function weekdayOf(value: DateLike, long = false): string {
  const date = toDate(value);
  if (!date) return "—";
  return (long ? WEEKDAYS_LONG : WEEKDAYS)[date.getDay()];
}

/** The small two-line date block used by rails and row gutters. */
export function dateParts(value: DateLike): { day: string; month: string; weekday: string } {
  const date = toDate(value);
  if (!date) return { day: "—", month: "", weekday: "" };
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: MONTHS[date.getMonth()].toUpperCase(),
    weekday: WEEKDAYS_MON[weekIndex(date)],
  };
}

/** "Today", "Tomorrow", "Yesterday", else "Tue 17 Nov". */
export function relativeDay(value: DateLike): string {
  const date = toDate(value);
  if (!date) return "Date to be announced";
  const diff = daysUntil(date) ?? 0;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return `${weekdayOf(date)} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Inclusive list of day keys from start to end, capped so a long event cannot run away. */
export function dayKeys(start: DateLike, end: DateLike, cap = 40): string[] {
  const first = startOfToday(toDate(start) ?? new Date());
  const last = startOfToday(toDate(end) ?? first);
  const keys: string[] = [];
  const cursor = new Date(first.getTime());
  while (cursor.getTime() <= last.getTime() && keys.length < cap) {
    keys.push(isoDay(cursor) as string);
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/** How far through an event a day key sits: 1-based day number, or null outside it. */
export function dayOfEvent(day: string, start: DateLike, end: DateLike): number | null {
  const target = parseIsoDay(day);
  const first = toDate(start);
  const last = toDate(end);
  if (!target || !first || !last) return null;
  const from = atMidnight(first).getTime();
  const to = atMidnight(last).getTime();
  const at = atMidnight(target).getTime();
  if (at < from || at > to) return null;
  return Math.round((at - from) / 86_400_000) + 1;
}

/** "18:30", from a local `YYYY-MM-DD HH:MM` stamp or a Date. */
export function clockLabel(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const match = typeof value === "string" ? value.match(/(\d{1,2}):(\d{2})\s*$/) : null;
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  return null;
}

/** The date half of a local `YYYY-MM-DD HH:MM` stamp. */
export function stampDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
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
