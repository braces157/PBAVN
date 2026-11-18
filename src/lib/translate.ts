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
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn();
    };

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
        res.on("error", (err) => finish(() => reject(err)));
        res.on("close", () => {
          if (!res.complete) {
            finish(() => reject(new Error("TRANSLATE_INCOMPLETE")));
          }
        });
        res.on("end", () => {
          if (!res.complete) {
            finish(() => reject(new Error("TRANSLATE_INCOMPLETE")));
            return;
          }
          finish(() =>
            resolve({
              status: res.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8"),
            }),
          );
        });
      },
    );

    // Start the deadline before the agent assigns a socket so queued calls time out on budget.
    timer = setTimeout(() => {
      const err = new Error("TRANSLATE_TIMEOUT");
      req.destroy(err);
      finish(() => reject(err));
    }, REQUEST_TIMEOUT_MS);

    req.on("error", (err) => finish(() => reject(err)));
    if (options.body) req.write(options.body);
    req.end();
  });
}

function validEnglish(out: string | null | undefined): string | null {
  if (!out) return null;
  const trimmed = out.trim();
  if (!trimmed || hasKorean(trimmed)) return null;
  return out;
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
    return validEnglish(segments.map((part) => part?.[0] ?? "").join(""));
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
    return validEnglish(parsed.translated_text ? decodeHtmlEntities(parsed.translated_text) : null);
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
    if (!out || out.startsWith("QUERY LENGTH LIMIT")) return null;
    return validEnglish(decodeHtmlEntities(out));
  } catch {
    return null;
  }
}

async function translateViaGoogleApiBatch(texts: string[], apiKey: string): Promise<string[] | null> {
  try {
    const res = await httpsJsonRequest(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ q: texts, source: "ko", target: "en", format: "text" }),
      },
    );
    if (res.status < 200 || res.status >= 300) return null;
    const parsed = JSON.parse(res.body) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };
    const items = parsed.data?.translations;
    if (!Array.isArray(items) || items.length !== texts.length) return null;
    const mapped = items.map((entry) =>
      validEnglish(entry?.translatedText ? decodeHtmlEntities(entry.translatedText) : null),
    );
    return mapped.every((item): item is string => item !== null) ? mapped : null;
  } catch {
    return null;
  }
}

async function translateViaDeepLBatch(texts: string[], apiKey: string): Promise<string[] | null> {
  try {
    const host = apiKey.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
    const res = await httpsJsonRequest(`https://${host}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ text: texts, source_lang: "KO", target_lang: "EN" }),
    });
    if (res.status < 200 || res.status >= 300) return null;
    const parsed = JSON.parse(res.body) as { translations?: Array<{ text?: string }> };
    const items = parsed.translations;
    if (!Array.isArray(items) || items.length !== texts.length) return null;
    const mapped = items.map((entry) => validEnglish(entry?.text));
    return mapped.every((item): item is string => item !== null) ? mapped : null;
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
                  text: `Translate the following Korean PBA 3-cushion billiards news text into natural English. Output only the translation:\n\n${text}`,
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
    return validEnglish(out);
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

async function translateChunks(
  parts: string[],
  joiner: string,
  fn: (part: string) => Promise<string | null>,
): Promise<string | null> {
  const out: string[] = [];
  for (const part of parts) {
    const translated = await fn(part);
    if (!translated) return null;
    out.push(translated);
  }
  return validEnglish(out.join(joiner));
}

async function translateSingleRaw(text: string): Promise<string> {
  const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (googleKey) {
    const translated = await translateViaGoogleApiBatch([text], googleKey);
    if (translated?.[0]) return translated[0];
  }

  const deeplKey = process.env.DEEPL_API_KEY?.trim();
  if (deeplKey) {
    const translated = await translateViaDeepLBatch([text], deeplKey);
    if (translated?.[0]) return translated[0];
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const translated = await translateViaGemini(text, geminiKey);
    if (translated) return translated;
  }

  if (Date.now() >= gtxBlockedUntil) {
    const translated = await translateChunks(chunkText(text, 3000), "", translateViaGtx);
    if (translated) return translated;
  }

  if (Date.now() >= simplyIcibaBlockedUntil) {
    const translated = await translateChunks(chunkText(text, 1400), "\n", translateViaSimplyIciba);
    if (translated) return translated;
  }

  if (Date.now() >= myMemoryBlockedUntil) {
    const translated = await translateChunks(chunkText(text, 380), " ", translateViaMyMemory);
    if (translated) return translated;
  }

  throw new Error("TRANSLATE_UNAVAILABLE");
}

const cachedTranslateSingle = unstable_cache(
  async (text: string) => translateSingleRaw(text),
  ["pba-translate-ko-en-v4"],
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
        const checked = validEnglish(out);
        if (!checked) return text;
        writeMemory(key, checked);
        return checked;
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
 * Translate a list of strings using provider-enforced 1:1 per-item mappings
 * (Google v2 / DeepL batch arrays, or per-item calls for single-string
 * providers) with optional render budget so callers like the home page never
 * block on slow external translation.
 */
async function translateManyKoToEn(
  texts: string[],
  options: { budgetMs?: number } = {},
): Promise<string[]> {
  if (texts.length === 0) return [];
  if (process.env.PBA_OFFLINE === "1") return texts;

  const results = [...texts];
  const uniqueMissing: string[] = [];
  const positionsByText = new Map<string, number[]>();

  for (let i = 0; i < texts.length; i += 1) {
    const t = texts[i];
    if (!t || !hasKorean(t)) continue;
    const hot = readMemory(cacheKey("txt", t));
    if (hot !== undefined) {
      results[i] = hot;
      continue;
    }
    const list = positionsByText.get(t);
    if (list) {
      list.push(i);
    } else {
      positionsByText.set(t, [i]);
      uniqueMissing.push(t);
    }
  }

  if (uniqueMissing.length === 0) return results;

  const assign = (source: string, translated: string) => {
    const positions = positionsByText.get(source);
    if (!positions) return;
    for (const pos of positions) results[pos] = translated;
  };

  const work = (async () => {
    const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
    if (googleKey) {
      const batch = await translateViaGoogleApiBatch(uniqueMissing, googleKey);
      if (batch) {
        for (let i = 0; i < uniqueMissing.length; i += 1) {
          writeMemory(cacheKey("txt", uniqueMissing[i]), batch[i]);
          assign(uniqueMissing[i], batch[i]);
        }
        return;
      }
    }

    const deeplKey = process.env.DEEPL_API_KEY?.trim();
    if (deeplKey) {
      const batch = await translateViaDeepLBatch(uniqueMissing, deeplKey);
      if (batch) {
        for (let i = 0; i < uniqueMissing.length; i += 1) {
          writeMemory(cacheKey("txt", uniqueMissing[i]), batch[i]);
          assign(uniqueMissing[i], batch[i]);
        }
        return;
      }
    }

    await mapConcurrent(uniqueMissing, 2, async (item) => {
      const translated = await translateKoToEn(item);
      assign(item, translated);
    });
  })();

  if (options.budgetMs !== undefined && options.budgetMs > 0) {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      work,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, options.budgetMs);
      }),
    ]);
    if (timer) clearTimeout(timer);
  } else {
    await work;
  }

  return results;
}

function safeFromCodePoint(raw: string, radix: number, fallback: string): string {
  const code = Number.parseInt(raw, radix);
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return fallback;
  return String.fromCodePoint(code);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (m, digits: string) => safeFromCodePoint(digits, 10, m))
    .replace(/&#x([0-9a-f]+);/gi, (m, hex: string) => safeFromCodePoint(hex, 16, m));
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Split HTML into raw tags and text nodes while respecting single- and
 * double-quoted attribute values so `>` inside attributes is never treated as a
 * tag terminator.
 */
function tokenizeHtml(html: string): { isTag: boolean; value: string }[] {
  const tokens: { isTag: boolean; value: string }[] = [];
  let i = 0;
  let textStart = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      if (i > textStart) {
        tokens.push({ isTag: false, value: html.slice(textStart, i) });
      }
      let j = i + 1;
      let quote: string | null = null;
      while (j < html.length) {
        const ch = html[j];
        if (quote) {
          if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === ">") {
          j += 1;
          break;
        }
        j += 1;
      }
      tokens.push({ isTag: true, value: html.slice(i, j) });
      i = j;
      textStart = j;
    } else {
      i += 1;
    }
  }

  if (textStart < html.length) {
    tokens.push({ isTag: false, value: html.slice(textStart) });
  }
  return tokens;
}

const cachedTranslateHtml = unstable_cache(
  async (html: string) => {
    const tokens = tokenizeHtml(html);
    const segmentIndices: number[] = [];
    const segmentCores: string[] = [];
    const leadingSpaces: string[] = [];
    const trailingSpaces: string[] = [];

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token.isTag || !token.value) continue;
      const decoded = decodeHtmlEntities(token.value);
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
      tokens[segmentIndices[i]].value = escapeHtmlText(
        `${leadingSpaces[i]}${translated[i]}${trailingSpaces[i]}`,
      );
    }

    return tokens.map((token) => token.value).join("");
  },
  ["pba-translate-html-v4"],
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

export async function translateArticleTitles(
  articles: Article[],
  options: { budgetMs?: number } = {},
): Promise<Article[]> {
  const translated = await translateManyKoToEn(
    articles.map((article) => article.title),
    options,
  );
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
