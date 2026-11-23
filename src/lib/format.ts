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

/** Whole-day difference between two YYYY-MM-DD keys (positive when `b` is later). */
function diffIsoDays(aKey: string, bKey: string): number | null {
  const a = parseIsoDay(aKey);
  const b = parseIsoDay(bKey);
  if (!a || !b) return null;
  const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bUtc - aUtc) / 86_400_000);
}

export function daysUntil(value: DateLike, now = new Date()): number | null {
  const key = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : isoDay(value);
  if (!key) return null;
  return diffIsoDays(kstDay(now), key);
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

/** A `YYYY-MM-DD` string read back as local noon (DST-safe), rejecting rolled-over dates. */
export function parseIsoDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(year, month - 1, day, 12, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
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

/** "18:30", from a local `YYYY-MM-DD HH:MM(:SS)` stamp or a Date. */
export function clockLabel(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?\s*$/);
    if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
    return null;
  }
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

/** Clean full-width Unicode glyphs and stray mojibake question marks from upstream labels. */
export function cleanDisplayText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .replace(/\uFFFD/g, " ")
    .replace(/([A-Za-z0-9])\?([A-Za-z0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean a player's display name: normalize full-width characters, remove stray
 * encoding artifacts (`Sung-ki?JUNG`), and strip upstream disambiguation digits
 * appended after the family name (`Won-jun CHOI1` -> `Won-jun CHOI`).
 */
export function cleanPlayerName(value: string | null | undefined): string {
  const cleaned = cleanDisplayText(value);
  if (!cleaned) return "";
  return cleaned
    .replace(/\?+/g, " ")
    .replace(/([A-Za-z\uAC00-\uD7A3])\s*[1-9]+$/, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const INITIALS_RR = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
];
const MEDIALS_RR = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];
const FINALS_RR = [
  "", "k", "k", "ks", "n", "nj", "nh", "t", "l", "lk", "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "t", "t", "ng", "t", "t", "k", "t", "p", "t",
];

const SURNAMES_RR: Record<string, string> = {
  김: "KIM",
  이: "LEE",
  박: "PARK",
  최: "CHOI",
  정: "JUNG",
  강: "KANG",
  조: "CHO",
  윤: "YOON",
  장: "JANG",
  임: "LIM",
  한: "HAN",
  오: "OH",
  서: "SEO",
  신: "SHIN",
  권: "KWON",
  황: "HWANG",
  안: "AHN",
  송: "SONG",
  유: "YOO",
  류: "RYU",
  전: "JEON",
  홍: "HONG",
  고: "KO",
  문: "MOON",
  양: "YANG",
  손: "SON",
  배: "BAE",
  백: "BAEK",
  허: "HEO",
  남: "NAM",
  심: "SIM",
  노: "NOH",
  하: "HA",
  곽: "KWAK",
  성: "SEONG",
  차: "CHA",
  주: "JOO",
  우: "WOO",
  구: "KOO",
  나: "NA",
  민: "MIN",
  엄: "EOM",
  진: "JIN",
  원: "WON",
  지: "JI",
  채: "CHAE",
  천: "CHEON",
  방: "BANG",
  현: "HYUN",
  변: "BYUN",
  염: "YEOM",
  추: "CHOO",
  석: "SEOK",
  선: "SUN",
  설: "SEOL",
};

function romanizeSyllable(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return ch;
  const idx = code - 0xac00;
  const initial = Math.floor(idx / 588);
  const medial = Math.floor((idx % 588) / 28);
  const final = idx % 28;
  return `${INITIALS_RR[initial]}${MEDIALS_RR[medial]}${FINALS_RR[final]}`;
}

export function hasHangul(value: string | null | undefined): boolean {
  return Boolean(value && /[\uAC00-\uD7A3]/.test(value));
}

/** Transliterate a Korean personal name (e.g. `오성욱` -> `Seong-uk OH`) when no English directory entry exists. */
export function romanizeKoreanName(value: string | null | undefined): string {
  const cleaned = cleanPlayerName(value);
  if (!cleaned) return "";
  if (!hasHangul(cleaned)) return cleaned;

  const stripped = cleaned.replace(/[1-9]+$/, "").trim();
  const syllables = [...stripped];
  if (syllables.length >= 2 && syllables.length <= 4 && syllables.every((c) => hasHangul(c))) {
    const surname = SURNAMES_RR[syllables[0]] ?? romanizeSyllable(syllables[0]).toUpperCase();
    const givenParts = syllables.slice(1).map(romanizeSyllable);
    const given = givenParts.join("-");
    const formattedGiven = given ? `${given[0].toUpperCase()}${given.slice(1)}` : "";
    return formattedGiven ? `${formattedGiven} ${surname}` : surname;
  }

  return syllables.map(romanizeSyllable).join("");
}

/** Upstream duplicates every label in EN and KO; prefer EN, fall back gracefully. */
export function pick(en: string | null | undefined, ko: string | null | undefined): string {
  const english = cleanDisplayText(en);
  if (!isPlaceholder(english)) return english;
  const korean = cleanDisplayText(ko);
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

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const YOUTUBE_ID = /^[\w-]{6,20}$/;

/** Safe `http:`/`https:` URL validator for untrusted/upstream links. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function youtubeId(url: string | null | undefined): string | null {
  const safe = safeHttpUrl(url);
  if (!safe) return null;
  try {
    const parsed = new URL(safe);
    const host = parsed.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return null;

    let candidate: string | null = null;
    if (host === "youtu.be" || host === "www.youtu.be") {
      candidate = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (parsed.pathname === "/watch") {
      candidate = parsed.searchParams.get("v");
    } else {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") {
        candidate = parts[1] ?? null;
      }
    }
    return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

/** YouTube watch/short/embed URLs → canonical embed URL, or null when not YouTube. */
export function youtubeEmbed(url: string | null | undefined): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

/** YouTube URL → canonical watch URL, safe to render in `<a href>`. */
export function youtubeWatchUrl(url: string | null | undefined): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
