import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import tls from "node:tls";
import { request as httpsRequest } from "node:https";
import { unstable_cache } from "next/cache";
import { recordFailure } from "./failures";
import { GLOBALSIGN_GCCR46_ALPHASSLCA2025_PEM } from "./certs";

/**
 * Transport for the pbatour.org data API.
 *
 * The quirks that shape it:
 *
 *  1. The upstream service sends no CORS headers, so every call happens on the
 *     server.
 *  2. Its TLS chain omits the intermediate certificate. Browsers paper over
 *     that by fetching the missing link; Node does not, so a plain `fetch`
 *     fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Every HTTPS call therefore
 *     goes over `node:https` with the missing intermediate pinned from
 *     ./certs, which verifies the chain fully instead of disabling
 *     verification. Trying `fetch` first only ever paid a doomed round trip,
 *     so it is gone.
 *  3. The upstream can be very slow on large queries — the full 2000-player
 *     directory answers in about eight seconds. `unstable_cache` stores each
 *     response for the endpoint's revalidate window. Unlike an in-process
 *     map, it survives restarts and, on a serverless host, is shared by every
 *     instance, so an expensive query is paid once per window, not once per
 *     visitor. It also reuses POST responses, which Next's fetch cache never
 *     does.
 *  4. The team-league terminal is plain HTTP and answers form posts; it
 *     shares the same cached path over `node:http`.
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
  /** Seconds the response may be served before a background refresh. */
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

/* ------------------------------------------------------------------- TLS */

/**
 * Every root `node:https` should trust here: Node's bundled store, any roots a
 * deployment adds through NODE_EXTRA_CA_CERTS (a TLS-inspecting proxy wires
 * its own root in that way), and the intermediate the upstream omits. A `ca`
 * list replaces the default trust store rather than adding to it, so the
 * other two groups have to ride along explicitly.
 */
const TRUSTED_CA = [
  ...tls.rootCertificates,
  ...extraCaRoots(),
  GLOBALSIGN_GCCR46_ALPHASSLCA2025_PEM,
];

/** PEM blocks from a `NODE_EXTRA_CA_CERTS` file, or none when it is absent. */
function extraCaRoots(): string[] {
  const path = process.env.NODE_EXTRA_CA_CERTS;
  if (!path) return [];
  try {
    return readFileSync(path, "utf8")
      .split("-----END CERTIFICATE-----")
      .filter((block) => block.includes("-----BEGIN CERTIFICATE-----"))
      .map((block) => `${block}-----END CERTIFICATE-----`);
  } catch {
    return [];
  }
}

interface RawResponse {
  status: number;
  body: Buffer;
  contentType: string;
}

function requestUpstream(
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
        // Full verification; TRUSTED_CA carries the intermediate the upstream
        // leaves out of its chain.
        ca: TRUSTED_CA,
        rejectUnauthorized: true,
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

/** Same shape as `requestUpstream`, for the team host that never had TLS. */
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

/**
 * One cached upstream read, shared by every text transport. Plain-HTTP targets
 * (the team terminal) ride `node:http`; everything else rides `node:https`
 * with `TRUSTED_CA`. Next keys the store on the callback's arguments, so the
 * method and body ride as arguments — the same team-terminal endpoint means
 * something different for every form posting. The revalidate window is part of
 * the key too: the same URL is read at two very different freshnesses (a match
 * card is archived at 86 400 s the moment it ends, 30 s while it is in play),
 * and a shared entry would let whichever caller read first pin its TTL on the
 * other — a live score frozen for a day, an archive refreshed every 30 s.
 * The cached body throws on any failure, so an outage or a placeholder status
 * is never stored, and the catch turns that into the null contract callers
 * already handle. `recordFailure` stays outside the cached closure because it
 * needs the render context.
 */
async function cachedText(
  url: string,
  options: {
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: string;
    timeoutMs: number;
    allowEmpty: boolean;
    revalidate: number;
  },
): Promise<string | null> {
  const request = unstable_cache(
    async (target: string, cacheMethod: "GET" | "POST", cacheBody: string | undefined) => {
      const result = target.startsWith("http://")
        ? await requestPlain(target, { ...options, method: cacheMethod, body: cacheBody })
        : await requestUpstream(target, { ...options, method: cacheMethod, body: cacheBody });
      if (
        result.status < 200 ||
        result.status >= 300 ||
        (result.body.length === 0 && !options.allowEmpty)
      ) {
        throw new Error(`PBA_UPSTREAM_STATUS_${result.status}`);
      }
      return result.body.toString("utf8");
    },
    ["pba-upstream", `ttl-${options.revalidate}`],
    { revalidate: options.revalidate },
  );

  try {
    return await request(url, options.method, options.body);
  } catch {
    recordFailure(url);
    return null;
  }
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

  return cachedText(url, {
    method,
    headers: mergedHeaders,
    body,
    timeoutMs,
    allowEmpty,
    revalidate,
  });
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
const BINARY_CACHE_LIMIT = 600;

/**
 * Expired entries leave first, then the least recently used ones pay for the
 * newcomer. Evicting one at a time keeps hot photos resident; the old wholesale
 * `clear()` re-fetched every image a page was showing the moment the cache
 * filled. Map iteration is insertion order, and reads re-insert, so the oldest
 * key is the least recently used.
 */
function storeBinary(url: string, asset: BinaryAsset, ttlSeconds: number): void {
  const now = Date.now();
  for (const [key, entry] of binaryCache) {
    if (entry.expires <= now) binaryCache.delete(key);
  }
  while (binaryCache.size >= BINARY_CACHE_LIMIT) {
    const oldest = binaryCache.keys().next().value;
    if (oldest === undefined) break;
    binaryCache.delete(oldest);
  }
  binaryCache.set(url, { expires: now + ttlSeconds * 1000, asset });
}

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
  if (cached && cached.expires > Date.now()) {
    binaryCache.delete(url);
    binaryCache.set(url, cached);
    return cached.asset;
  }

  try {
    const result = await requestUpstream(url, {
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
    storeBinary(url, asset, options.ttlSeconds ?? 21_600);
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
    // Every current caller names its own window (live boards 10 s, scorecards
    // 30 s, brackets 600 s); the default is a floor, not a policy.
    revalidate: options.revalidate ?? 60,
    timeoutMs: options.timeoutMs ?? 6_000,
    accept: "text/html, */*",
    referer: `${APP_ORIGIN}/mob/contest_new/admin_en/live_info.asp`,
    allowEmpty: options.allowEmpty,
  });
}

/*
 * Reading a match without reading its date.
 *
 * The terminal localises a bracket row in two independent ways:
 *
 *   LangCode=en   names in Latin script, but the kickoff is cut to "HH:MM" and
 *                 the win/loss mark is dropped from the result cell;
 *   LangCode=ko   names in Korean, but the kickoff is the full "YY-MM-DD HH:MM"
 *                 and the W/L mark is there.
 *
 * A screen that needs to know *when* a match was played therefore has to read
 * the Korean variant and translate the names afterwards. The two are kept apart
 * deliberately: `fetchHtmlFragment` is the English form every existing caller
 * uses, and this one exists only for the calendar reads in `./matches-on-day`.
 */
export async function fetchDatedHtmlFragment(
  path: string,
  options: { revalidate?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  const url = path.startsWith("http") ? path : `${APP_ORIGIN}${path}`;
  return getText(url, {
    revalidate: options.revalidate ?? 10,
    timeoutMs: options.timeoutMs ?? 8_000,
    accept: "text/html, */*",
    referer: `${APP_ORIGIN}/mob/contest_new/admin_en/live_info.asp`,
  });
}

/* ------------------------------------------------------------ team terminal */

/**
 * Fragment transport for the team-league terminal at `team.pbatour.org`.
 *
 * That host is plain HTTP and answers form posts, so Next's fetch cache never
 * sees a reusable response; `cachedText` stores these reads in the same
 * persistent store as everything else, POSTs included, keyed by method, URL
 * and body because the same endpoint means something different for every form
 * posting. Failure recording, the offline flag and the timeout policy are the
 * ones every other transport shares.
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

  const teamHeaders: Record<string, string> = {
    "User-Agent": BASE_HEADERS["User-Agent"],
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    // The terminal sits behind its own pages; the plan page is their referrer.
    Referer: `${TEAM_ORIGIN}/mob/ko/planDetail.asp`,
    ...(body ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
  };

  return cachedText(url, {
    method,
    headers: teamHeaders,
    body,
    timeoutMs,
    allowEmpty,
    revalidate,
  });
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
