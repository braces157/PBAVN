import sanitizeHtml from "sanitize-html";

/**
 * The press room stores article bodies as CMS HTML. We parse and rebuild them
 * with a strict allowlist (htmlparser2 via `sanitize-html`), rewrite relative
 * asset paths to the association's media origin, and force outbound links to
 * open safely.
 */

const ASSET_HOST = "https://pbatour.org";
const PROXYABLE_UPLOAD =
  /^https:\/\/(?:www\.)?pbatour\.org\/resources\/upload\/((?:tournament|board|sponsor|team|banner|media)\/[\w./-]+\.(?:png|jpe?g|webp|gif))$/i;

function toAbsoluteAsset(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("/api/photo?")) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return `${ASSET_HOST}${trimmed}`;
  }
  return trimmed;
}

function hasUnsafeSegments(path: string): boolean {
  if (path.includes("\\") || path.includes("//")) return true;
  return path.split("/").some((segment) => segment === "." || segment === "..");
}

function toProxiedImage(url: string): string {
  const match = url.match(PROXYABLE_UPLOAD);
  if (!match) return url;
  const rel = `/${match[1]}`;
  if (hasUnsafeSegments(rel)) return url;
  return `/api/photo?src=${encodeURIComponent(rel)}&w=1200`;
}

export function sanitizeCmsHtml(input: string | null | undefined): string {
  if (!input) return "";

  const cleaned = sanitizeHtml(input, {
    allowedTags: [
      "p",
      "br",
      "hr",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "ul",
      "ol",
      "li",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "sub",
      "sup",
      "span",
      "div",
      "figure",
      "figcaption",
      "img",
      "a",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "caption",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: ["style", "script", "textarea", "option", "noscript", "iframe", "object", "embed", "svg", "math", "template"],
    transformTags: {
      a: (_tagName, attribs) => {
        const href = attribs.href ? toAbsoluteAsset(attribs.href) : "";
        return {
          tagName: "a",
          attribs: {
            ...(href ? { href } : {}),
            ...(attribs.title ? { title: attribs.title } : {}),
            target: "_blank",
            rel: "noreferrer noopener",
          },
        };
      },
      img: (_tagName, attribs) => {
        const absolute = attribs.src ? toAbsoluteAsset(attribs.src) : "";
        const src = absolute ? toProxiedImage(absolute) : "";
        return {
          tagName: "img",
          attribs: {
            ...(src ? { src } : {}),
            alt: attribs.alt ?? "",
            ...(attribs.title ? { title: attribs.title } : {}),
            loading: "lazy",
          },
        };
      },
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });

  // Drop empty spacer paragraphs (`<p>&nbsp;</p>`) after allowlist filtering.
  return cleaned.replace(/<p\b[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi, "").trim();
}

/** Plain-text length, used to decide whether a body is worth rendering. */
export function htmlTextLength(html: string | null | undefined): number {
  if (!html) return 0;
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length;
}
