import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { recordFailure } from "./failures";

/**
 * Transport for the pbatour.org data API.
 *
 * Two quirks shape this module:
 *
 *  1. The upstream service sends no CORS headers, so every call happens on the
 *     server.
 *  2. Its TLS chain omits the intermediate certificate. Browsers paper over
 *     that by fetching the missing link; Node does not, so a plain `fetch`
 *     fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
 *
 * We therefore try the normal `fetch` first — which is what Next caches — and
 * fall back to a `node:https` request that trusts the chain only for the
 * association's own hosts. The fallback keeps a short in-process cache so a
 * request storm does not turn into an upstream storm.
 */



/**
 * Set `PBA_OFFLINE=1` to make every call fail. Used to exercise the degraded-data
 * path and the partial-data banner without touching the network.
 */
const FORCED_OFFLINE = process.env.PBA_OFFLINE === "1";

export const SITE_ORIGIN = "https://www.pbatour.org";
export const APP_ORIGIN = "https://app.pbatour.org";
/** The team-league terminal: plain HTTP, POST form bodies, no TLS. */
export const TEAM_ORIGIN = "http://team.pbatour.org";
/** Player photos, team logos, sponsor artwork and tournament logos live here. */
export const ASSET_ORIGIN = "https://pbatour.org/resources/upload";

/** The upstream serves identical data on `/en` and `/ko`; we always prefer `_EN` fields. */
const LANG = "en";

const DEFAULT_TIMEOUT_MS = 12_000;

const BASE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
  Referer: `${SITE_ORIGIN}/${LANG}/index`,
  "X-Requested-With": "XMLHttpRequest",
};

export interface FetchOptions {
  /** Seconds the Next.js data cache may reuse this response. */
  revalidate?: number;
  timeoutMs?: number;
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  /** A 200 with an empty body is a real answer, not a failure. Opt-in per call. */
  allowEmpty?: boolean;
}

export interface PbaEnvelope<T> {
  resultCode?: string;
  resultMsg?: string;
  list?: T[];
  data?: T;
  result?: { list?: T[]; data?: T[] };
  page?: { totcnt?: number; curPage?: number; nTotalPageSize?: number };
  [key: string]: unknown;
}

/* ------------------------------------------------------------- TLS fallback */

const TLS_MARKERS = [
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
];

function isTlsFailure(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    const code = (current as { code?: string }).code ?? "";
    const message = (current as { message?: string }).message ?? "";
    if (TLS_MARKERS.some((marker) => code.includes(marker) || message.includes(marker))) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

interface CacheEntry {
  expires: number;
  body: string;
}

const fallbackCache = new Map<string, CacheEntry>();
/** Primary cache for the plain-HTTP team host; POSTs never hit Next's data cache. */
const teamCache = new Map<string, CacheEntry>();

function readCache(cache: Map<string, CacheEntry>, key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.body;
}

function writeCache(cache: Map<string, CacheEntry>, key: string, body: string, ttlSeconds: number): void {
  if (cache.size > 400) {
    // Cheap eviction: drop the oldest insertion order entries.
    const keys = [...cache.keys()].slice(0, 120);
    for (const stale of keys) cache.delete(stale);
  }
  cache.set(key, { expires: Date.now() + Math.max(1, ttlSeconds) * 1000, body });
}

interface RawResponse {
  status: number;
  body: Buffer;
  contentType: string;
}

function requestInsecure(
  url: string,
  options: { method: string; headers: Record<string, string>; body?: string; timeoutMs: number },
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = httpsRequest(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: options.method,
        headers: {
          ...options.headers,
          // Avoid gzip: node:https does not decompress for us.
          "Accept-Encoding": "identity",
          ...(options.body ? { "Content-Length": Buffer.byteLength(options.body) } : {}),
        },
        // The missing intermediate is the whole reason we are here.
        rejectUnauthorized: false,
        servername: target.hostname,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks),
            contentType: String(response.headers["content-type"] ?? ""),
          });
        });
      },
    );

    request.setTimeout(options.timeoutMs, () => {
      request.destroy(new Error("PBA_UPSTREAM_TIMEOUT"));
    });
    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

/** Same shape as `requestInsecure`, for the team host that never had TLS. */
function requestPlain(
  url: string,
  options: { method: string; headers: Record<string, string>; body?: string; timeoutMs: number },
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = httpRequest(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 80,
        path: `${target.pathname}${target.search}`,
        method: options.method,
        headers: {
          ...options.headers,
          // node:http does not decompress either.
          "Accept-Encoding": "identity",
          ...(options.body ? { "Content-Length": Buffer.byteLength(options.body) } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks),
            contentType: String(response.headers["content-type"] ?? ""),
          });
        });
      },
    );

    request.setTimeout(options.timeoutMs, () => {
      request.destroy(new Error("PBA_UPSTREAM_TIMEOUT"));
    });
    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

/* ----------------------------------------------------------- failure signal */


/* ------------------------------------------------------------------ helpers */

/** Join a query object into a search string, dropping empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

async function getText(
  url: string,
  options: FetchOptions & { accept?: string; referer?: string },
): Promise<string | null> {
  const {
    revalidate = 300,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    method = "GET",
    body,
    headers,
    accept,
    referer,
    allowEmpty = false,
  } = options;

  if (FORCED_OFFLINE) {
    recordFailure(url);
    return null;
  }

  const mergedHeaders: Record<string, string> = {
    ...BASE_HEADERS,
    ...(accept ? { Accept: accept } : {}),
    ...(referer ? { Referer: referer } : {}),
    ...(body ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
    ...headers,
  };

  // 1. Native fetch — the path Next can cache across requests.
  try {
    const response = await fetch(url, {
      method,
      headers: mergedHeaders,
      body,
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate },
    });
    if (response.ok) {
      const text = await response.text();
      if (!text && !allowEmpty) {
        recordFailure(url);
        return null;
      }
      return text;
    }
    recordFailure(url);
    return null;
  } catch (error) {
    if (!isTlsFailure(error)) {
      recordFailure(url);
      return null;
    }
  }

  // 2. Chain-broken fallback.
  const cacheKey = `${method} ${url} ${body ?? ""}`;
  const cached = readCache(fallbackCache, cacheKey);
  if (cached) return cached;

  try {
    const result = await requestInsecure(url, { method, headers: mergedHeaders, body, timeoutMs });
    if (result.status < 200 || result.status >= 300 || (result.body.length === 0 && !allowEmpty)) {
      recordFailure(url);
      return null;
    }
    const text = result.body.toString("utf8");
    writeCache(fallbackCache, cacheKey, text, Math.min(revalidate, 300));
    return text;
  } catch {
    recordFailure(url);
    return null;
  }
}

/* ---------------------------------------------------------------- binary */

export interface BinaryAsset {
  body: Buffer;
  contentType: string;
}

interface BinaryEntry {
  expires: number;
  asset: BinaryAsset;
}

const binaryCache = new Map<string, BinaryEntry>();

/**
 * Fetch an image from the asset host.
 *
 * Images cannot go through `fetch` for the same reason JSON cannot — the chain
 * is broken — so this uses the same trusted-hosts request path, with its own
 * cache because photos are large and repeat on every page view.
 */
export async function fetchBinary(
  url: string,
  options: { timeoutMs?: number; ttlSeconds?: number } = {},
): Promise<BinaryAsset | null> {
  if (FORCED_OFFLINE) return null;

  const cached = binaryCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.asset;

  try {
    const result = await requestInsecure(url, {
      method: "GET",
      headers: {
        "User-Agent": BASE_HEADERS["User-Agent"],
        Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
        Referer: `${SITE_ORIGIN}/`,
      },
      timeoutMs: options.timeoutMs ?? 15_000,
    });
    if (result.status < 200 || result.status >= 300 || result.body.length === 0) return null;

    const asset: BinaryAsset = { body: result.body, contentType: result.contentType };
    if (binaryCache.size > 600) binaryCache.clear();
    binaryCache.set(url, {
      expires: Date.now() + (options.ttlSeconds ?? 21_600) * 1000,
      asset,
    });
    return asset;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------- calls */

/** Call the JSON API. Returns `null` on any transport or parse failure. */
export async function fetchJson<T = PbaEnvelope<unknown>>(
  path: string,
  options: FetchOptions = {},
): Promise<T | null> {
  const url = path.startsWith("http") ? path : `${SITE_ORIGIN}/${LANG}${path}`;
  const text = await getText(url, options);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Call a legacy ASP page that answers with an HTML fragment. */
export async function fetchHtmlFragment(
  path: string,
  options: { revalidate?: number; timeoutMs?: number; allowEmpty?: boolean } = {},
): Promise<string | null> {
  const url = path.startsWith("http") ? path : `${APP_ORIGIN}${path}`;
  return getText(url, {
    revalidate: options.revalidate ?? 10,
    timeoutMs: options.timeoutMs ?? 6_000,
    accept: "text/html, */*",
    referer: `${APP_ORIGIN}/mob/contest_new/admin_en/live_info.asp`,
    allowEmpty: options.allowEmpty,
  });
}

/* ------------------------------------------------------------ team terminal */

/**
 * Fragment transport for the team-league terminal at `team.pbatour.org`.
 *
 * That host is plain HTTP and answers only POST form bodies, so Next's data
 * cache never sees a reusable response — the in-process cache below is the
 * primary path, not a fallback, and it is keyed by method, URL and body because
 * the same endpoint means something different for every form posting. Native
 * `fetch` still runs beneath it (it may gain GET caching later), and a
 * `node:http` request is the last resort. Failure recording, the offline flag
 * and the timeout policy are the ones every other transport shares.
 */
export async function fetchTeamFragment(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: string;
    revalidate?: number;
    timeoutMs?: number;
    allowEmpty?: boolean;
  } = {},
): Promise<string | null> {
  const {
    method = "GET",
    body,
    revalidate = 300,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    allowEmpty = false,
  } = options;

  const url = path.startsWith("http") ? path : `${TEAM_ORIGIN}${path}`;

  if (FORCED_OFFLINE) {
    recordFailure(url);
    return null;
  }

  const cacheKey = `${method} ${url} ${body ?? ""}`;
  const cached = readCache(teamCache, cacheKey);
  if (cached !== null) return cached;

  const teamHeaders: Record<string, string> = {
    "User-Agent": BASE_HEADERS["User-Agent"],
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    // The terminal sits behind its own pages; the plan page is their referrer.
    Referer: `${TEAM_ORIGIN}/mob/ko/planDetail.asp`,
    ...(body ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
  };

  // 1. Native fetch.
  try {
    const response = await fetch(url, {
      method,
      headers: teamHeaders,
      body,
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate },
    });
    if (response.ok) {
      const text = await response.text();
      if (!text && !allowEmpty) {
        recordFailure(url);
        return null;
      }
      writeCache(teamCache, cacheKey, text, revalidate);
      return text;
    }
    recordFailure(url);
    return null;
  } catch {
    // Plain HTTP has no certificate failure mode; every error falls through.
  }

  // 2. node:http fallback.
  try {
    const result = await requestPlain(url, { method, headers: teamHeaders, body, timeoutMs });
    if (result.status < 200 || result.status >= 300 || (result.body.length === 0 && !allowEmpty)) {
      recordFailure(url);
      return null;
    }
    const text = result.body.toString("utf8");
    writeCache(teamCache, cacheKey, text, revalidate);
    return text;
  } catch {
    recordFailure(url);
    return null;
  }
}

/** Prefix an upstream relative asset path with the asset CDN origin. */
export function asset(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${ASSET_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Upstream flags a fair number of assets as literal placeholder strings. */
export function isRealAsset(path: string | null | undefined): boolean {
  if (!path) return false;
  const trimmed = path.trim();
  if (!trimmed) return false;
  return !/^(tbd|tba|n\/a|none|null|undefined|-|미정|없음)$/i.test(trimmed);
}
