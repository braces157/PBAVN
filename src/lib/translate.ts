import { createHash } from "node:crypto";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import { unstable_cache } from "next/cache";
import { excerpt, stripTags } from "./format";
import type { Article } from "./normalize";

const HANGUL_RE = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;
const TRANSLATE_TTL_SECONDS = 604_800; // 7 days
const MEMORY_CACHE_LIMIT = 2000;
const REQUEST_TIMEOUT_MS = 6_000;
const COOLDOWN_MS = 120_000; // 2 minutes on 429/quota

const translateAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: 4,
});

const memoryCache = new Map<string, { value: string; expires: number }>();
const inFlight = new Map<string, Promise<string>>();

let gtxBlockedUntil = 0;
let simplyIcibaBlockedUntil = 0;
let myMemoryBlockedUntil = 0;

export function hasKorean(text: string | null | undefined): boolean {
  return Boolean(text && HANGUL_RE.test(text));
}

function cacheKey(prefix: string, input: string): string {
  return `${prefix}:${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

function readMemory(key: string): string | undefined {
  const hit = memoryCache.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  memoryCache.delete(key);
  memoryCache.set(key, hit);
  return hit.value;
}

function writeMemory(key: string, value: string): void {
  while (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
  memoryCache.set(key, {
    value,
    expires: Date.now() + TRANSLATE_TTL_SECONDS * 1000,
  });
}

function httpsJsonRequest(
  url: string,
  options: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = httpsRequest(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: options.method ?? "GET",
        agent: translateAgent,
        headers: {
          "User-Agent": "Mozilla/5.0",
          ...(options.body
            ? {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Content-Length": Buffer.byteLength(options.body),
              }
            : {}),
          ...options.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error("TRANSLATE_TIMEOUT"));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function translateViaGtx(text: string): Promise<string | null> {
  if (Date.now() < gtxBlockedUntil) return null;
  try {
    const res = await httpsJsonRequest(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t",
      { method: "POST", body: `q=${encodeURIComponent(text)}` },
    );
    if (res.status === 429 || res.status === 403) {
      gtxBlockedUntil = Date.now() + COOLDOWN_MS;
      return null;
    }
    if (res.status < 200 || res.status >= 300) return null;
    const parsed = JSON.parse(res.body) as [Array<[string, ...unknown[]]>?];
    const segments = parsed?.[0];
    if (!Array.isArray(segments)) return null;
    const out = segments.map((part) => part?.[0] ?? "").join("");
    return out.trim() ? out : null;
  } catch {
    return null;
  }
}

async function translateViaSimplyIciba(text: string): Promise<string | null> {
  if (Date.now() < simplyIcibaBlockedUntil) return null;
  try {
    const res = await httpsJsonRequest("https://simplytranslate.org/api/translate", {
      method: "POST",
      body: `engine=iciba&from=ko&to=en&text=${encodeURIComponent(text)}`,
    });
    if (res.status === 429 || res.status === 403) {
      simplyIcibaBlockedUntil = Date.now() + COOLDOWN_MS;
      return null;
    }
    if (res.status < 200 || res.status >= 300) return null;
    const parsed = JSON.parse(res.body) as { translated_text?: string };
    const out = parsed.translated_text;
    if (!out || !out.trim()) return null;
    return decodeHtmlEntities(out);
  } catch {
    return null;
  }
}

async function translateViaMyMemory(text: string): Promise<string | null> {
  if (Date.now() < myMemoryBlockedUntil) return null;
  // MyMemory enforces a ~500-byte query cap per request.
  if (text.length > 420) return null;
  try {
    const res = await httpsJsonRequest(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ko|en`,
    );
    if (res.status === 429) {
      myMemoryBlockedUntil = Date.now() + COOLDOWN_MS;
      return null;
    }
    if (res.status < 200 || res.status >= 300) return null;
    const parsed = JSON.parse(res.body) as {
      responseStatus?: number;
      quotaFinished?: boolean;
      responseData?: { translatedText?: string };
    };
    if (parsed.quotaFinished || parsed.responseStatus === 429) {
      myMemoryBlockedUntil = Date.now() + COOLDOWN_MS;
      return null;
    }
    const out = parsed.responseData?.translatedText;
    if (!out || !out.trim() || out.startsWith("QUERY LENGTH LIMIT")) return null;
    return decodeHtmlEntities(out);
  } catch {
    return null;
  }
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    let splitAt = rest.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen / 2) splitAt = rest.lastIndexOf(". ", maxLen);
    if (splitAt < maxLen / 2) splitAt = rest.lastIndexOf(" ", maxLen);
    if (splitAt <= 0) splitAt = maxLen;
    chunks.push(rest.slice(0, splitAt + 1));
    rest = rest.slice(splitAt + 1);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function translateViaGoogleApi(text: string, apiKey: string): Promise<string | null> {
  try {
    const res = await httpsJsonRequest(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ q: text, source: "ko", target: "en", format: "text" }),
      },
    );
    if (res.status < 200 || res.status >= 300) return null;
    const parsed = JSON.parse(res.body) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };
    const out = parsed.data?.translations?.[0]?.translatedText;
    return out && out.trim() ? decodeHtmlEntities(out) : null;
  } catch {
    return null;
  }
}

async function translateViaDeepL(text: string, apiKey: string): Promise<string | null> {
  try {
    const host = apiKey.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
    const res = await httpsJsonRequest(`https://${host}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ text: [text], source_lang: "KO", target_lang: "EN" }),
    });
    if (res.status < 200 || res.status >= 300) return null;
    const parsed = JSON.parse(res.body) as { translations?: Array<{ text?: string }> };
    const out = parsed.translations?.[0]?.text;
    return out && out.trim() ? out : null;
  } catch {
    return null;
  }
}

async function translateViaGemini(text: string, apiKey: string): Promise<string | null> {
  try {
    const res = await httpsJsonRequest(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Translate the following Korean PBA 3-cushion billiards news text into natural English. Preserve line breaks exactly (one translated line per input line). Output only the translation:\n\n${text}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
      },
    );
    if (res.status < 200 || res.status >= 300) return null;
    const parsed = JSON.parse(res.body) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const out = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    return out && out.trim() ? out.trim() : null;
  } catch {
    return null;
  }
}

async function translateSingleRaw(text: string): Promise<string> {
  const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (googleKey) {
    const translated = await translateViaGoogleApi(text, googleKey);
    if (translated) return translated;
  }

  const deeplKey = process.env.DEEPL_API_KEY?.trim();
  if (deeplKey) {
    const translated = await translateViaDeepL(text, deeplKey);
    if (translated) return translated;
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const translated = await translateViaGemini(text, geminiKey);
    if (translated) return translated;
  }

  const gtxParts = chunkText(text, 3000);
  if (Date.now() >= gtxBlockedUntil) {
    const out: string[] = [];
    let ok = true;
    for (const part of gtxParts) {
      const translated = await translateViaGtx(part);
      if (!translated) {
        ok = false;
        break;
      }
      out.push(translated);
    }
    if (ok) return out.join("");
  }

  const icibaParts = chunkText(text, 1400);
  if (Date.now() >= simplyIcibaBlockedUntil) {
    const out: string[] = [];
    let ok = true;
    for (const part of icibaParts) {
      const translated = await translateViaSimplyIciba(part);
      if (!translated) {
        ok = false;
        break;
      }
      out.push(translated);
    }
    if (ok) return out.join("\n");
  }

  const mmParts = chunkText(text, 380);
  if (Date.now() >= myMemoryBlockedUntil) {
    const out: string[] = [];
    let ok = true;
    for (const part of mmParts) {
      const translated = await translateViaMyMemory(part);
      if (!translated) {
        ok = false;
        break;
      }
      out.push(translated);
    }
    if (ok) return out.join("\n");
  }

  throw new Error("TRANSLATE_UNAVAILABLE");
}

const cachedTranslateSingle = unstable_cache(
  async (text: string) => translateSingleRaw(text),
  ["pba-translate-ko-en-v3"],
  { revalidate: TRANSLATE_TTL_SECONDS },
);

/**
 * Translate Korean text to English with persistent + in-memory caching.
 * Returns the original string immediately when no Hangul is present or if
 * translation is offline/unavailable.
 */
export async function translateKoToEn(text: string): Promise<string> {
  if (!text || !hasKorean(text)) return text;
  if (process.env.PBA_OFFLINE === "1") return text;

  const key = cacheKey("txt", text);
  const hot = readMemory(key);
  if (hot !== undefined) return hot;

  let pending = inFlight.get(key);
  if (!pending) {
    pending = cachedTranslateSingle(text)
      .then((out) => {
        if (!out || hasKorean(out)) return text;
        writeMemory(key, out);
        return out;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, pending);
  }

  try {
    return await pending;
  } catch {
    return text;
  }
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
  return results;
}

/**
 * Translate a list of strings in minimal batched requests so pages with 10-15
 * headlines or paragraphs don't trigger per-request rate limits.
 */
async function translateManyKoToEn(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  if (process.env.PBA_OFFLINE === "1") return texts;

  const results = [...texts];
  const missingIndices: number[] = [];

  for (let i = 0; i < texts.length; i += 1) {
    const t = texts[i];
    if (!t || !hasKorean(t)) continue;
    const hot = readMemory(cacheKey("txt", t));
    if (hot !== undefined) {
      results[i] = hot;
    } else {
      missingIndices.push(i);
    }
  }

  if (missingIndices.length === 0) return results;

  const hasApiKey = Boolean(
    process.env.GOOGLE_TRANSLATE_API_KEY?.trim() ||
      process.env.DEEPL_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim(),
  );
  const maxBatchChars =
    hasApiKey || Date.now() >= gtxBlockedUntil
      ? 2400
      : Date.now() >= simplyIcibaBlockedUntil
        ? 1400
        : 360;
  const batches: number[][] = [];
  let current: number[] = [];
  let currentLen = 0;

  for (const idx of missingIndices) {
    const clean = texts[idx].replace(/\r?\n+/g, " ").trim();
    if (!clean) continue;
    if (current.length > 0 && currentLen + clean.length + 1 > maxBatchChars) {
      batches.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(idx);
    currentLen += clean.length + 1;
  }
  if (current.length > 0) batches.push(current);

  const fallbackIndices: number[] = [];

  for (const batch of batches) {
    if (batch.length === 1) {
      fallbackIndices.push(batch[0]);
      continue;
    }

    const joined = batch.map((idx) => texts[idx].replace(/\r?\n+/g, " ").trim()).join("\n");
    const batchKey = cacheKey("batch", joined);
    let translatedJoined: string | null = readMemory(batchKey) ?? null;

    if (translatedJoined === null) {
      try {
        translatedJoined = await cachedTranslateSingle(joined);
        if (translatedJoined && !hasKorean(translatedJoined)) {
          writeMemory(batchKey, translatedJoined);
        }
      } catch {
        translatedJoined = null;
      }
    }

    const lines = translatedJoined ? translatedJoined.split(/\r?\n/).map((l) => l.trim()) : null;
    if (lines && lines.length === batch.length && lines.every((l) => l.length > 0 && !hasKorean(l))) {
      for (let i = 0; i < batch.length; i += 1) {
        const idx = batch[i];
        results[idx] = lines[i];
        writeMemory(cacheKey("txt", texts[idx]), lines[i]);
      }
    } else {
      fallbackIndices.push(...batch);
    }
  }

  if (fallbackIndices.length > 0) {
    const resolved = await mapConcurrent(fallbackIndices, 2, (idx) => translateKoToEn(texts[idx]));
    for (let i = 0; i < fallbackIndices.length; i += 1) {
      results[fallbackIndices[i]] = resolved[i];
    }
  }

  return results;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _m;
    });
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const cachedTranslateHtml = unstable_cache(
  async (html: string) => {
    const parts = html.split(/(<[^>]+>)/g);
    const segmentIndices: number[] = [];
    const segmentCores: string[] = [];
    const leadingSpaces: string[] = [];
    const trailingSpaces: string[] = [];

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (!part || part.startsWith("<")) continue;
      const decoded = decodeHtmlEntities(part);
      if (!hasKorean(decoded)) continue;
      const leading = decoded.match(/^\s*/)?.[0] ?? "";
      const trailing = decoded.match(/\s*$/)?.[0] ?? "";
      const core = decoded.trim();
      if (!core) continue;
      segmentIndices.push(i);
      segmentCores.push(core);
      leadingSpaces.push(leading);
      trailingSpaces.push(trailing);
    }

    if (segmentCores.length === 0) return html;

    const translated = await translateManyKoToEn(segmentCores);
    // Do not persist partially-untranslated HTML in unstable_cache.
    if (translated.some((line) => hasKorean(line))) {
      throw new Error("TRANSLATE_INCOMPLETE");
    }

    for (let i = 0; i < segmentIndices.length; i += 1) {
      parts[segmentIndices[i]] = escapeHtmlText(
        `${leadingSpaces[i]}${translated[i]}${trailingSpaces[i]}`,
      );
    }

    return parts.join("");
  },
  ["pba-translate-html-v3"],
  { revalidate: TRANSLATE_TTL_SECONDS },
);

/**
 * Translate Korean text inside CMS HTML while leaving all HTML tags and
 * attributes untouched.
 */
export async function translateHtmlKoToEn(html: string): Promise<string> {
  if (!html || !hasKorean(html)) return html;
  if (process.env.PBA_OFFLINE === "1") return html;

  const key = cacheKey("html", html);
  const hot = readMemory(key);
  if (hot !== undefined) return hot;

  let pending = inFlight.get(key);
  if (!pending) {
    pending = cachedTranslateHtml(html)
      .then((out) => {
        writeMemory(key, out);
        return out;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, pending);
  }

  try {
    return await pending;
  } catch {
    return html;
  }
}

export async function translateArticleTitles(articles: Article[]): Promise<Article[]> {
  const translated = await translateManyKoToEn(articles.map((article) => article.title));
  return articles.map((article, i) => ({
    ...article,
    title: translated[i],
  }));
}

export function extractArticleLead(html: string | null | undefined, title: string, max = 180): string {
  if (!html) return "";
  const bareTitle = stripTags(title).replace(/^\[[^\]]+\]\s*/, "").replace(/\s+/g, " ").trim();
  const paragraphs = html
    .split(/<\/p>|<br\s*\/?>/gi)
    .map((p) => stripTags(decodeHtmlEntities(p)).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0 && p !== bareTitle && !bareTitle.includes(p));

  const prose =
    paragraphs.find((p) => p.length >= 45 && /[다.?!]$/.test(p)) ??
    paragraphs.find((p) => p.length >= 45) ??
    paragraphs[0];

  if (!prose) return excerpt(html, max);
  return prose.length <= max ? prose : `${prose.slice(0, max - 1).trimEnd()}…`;
}

export async function translateArticleSummaries(
  articles: Article[],
  excerptChars = 160,
): Promise<(Article & { summary: string })[]> {
  const titles = articles.map((a) => a.title);
  const leads = articles.map((a) => extractArticleLead(a.body, a.title, excerptChars));
  const combined = await translateManyKoToEn([...titles, ...leads]);
  return articles.map((article, i) => ({
    ...article,
    title: combined[i],
    summary: combined[articles.length + i],
  }));
}

export async function translateArticleFull(
  article: Article,
  sanitizedBody: string,
): Promise<{
  article: Article;
  body: string;
}> {
  const [title, body] = await Promise.all([
    translateKoToEn(article.title),
    translateHtmlKoToEn(sanitizedBody),
  ]);
  return {
    article: { ...article, title },
    body,
  };
}

export async function translatePlainTitles(titles: string[]): Promise<string[]> {
  return translateManyKoToEn(titles.map((title) => stripTags(title)));
}
