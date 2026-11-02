/**
 * The press room stores article bodies as CMS HTML. We render them, so the body
 * is reduced to a conservative allow-list of structure and formatting: scripts,
 * frames, form controls, event handlers and `javascript:` URLs are removed, and
 * relative asset paths are rewritten to the association's media origin.
 */

const ASSET_HOST = "https://pbatour.org";

const BLOCKED_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "link",
  "meta",
  "base",
  "noscript",
];

export function sanitizeCmsHtml(input: string | null | undefined): string {
  if (!input) return "";

  let html = input;

  // Remove blocked elements including their contents.
  for (const tag of BLOCKED_TAGS) {
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }

  // Strip event handlers and inline styles that could hide or overlay content.
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, "");

  // Neutralise script-bearing URLs.
  html = html.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');

  // Rewrite relative media to the association's origin.
  html = html.replace(
    /(src|href)\s*=\s*("|')\/(?!\/)([^"']*)\2/gi,
    (_match, attr, quote, path) => `${attr}=${quote}${ASSET_HOST}/${path}${quote}`,
  );

  // Force outbound links to open safely.
  html = html.replace(/<a\b([^>]*)>/gi, (_match: string, attrs: string) => {
    let next = attrs.replace(/\starget\s*=\s*("[^"]*"|'[^']*')/gi, "");
    next = next.replace(/\srel\s*=\s*("[^"]*"|'[^']*')/gi, "");
    return `<a${next} target="_blank" rel="noreferrer noopener">`;
  });

  return html.trim();
}

/** Plain-text length, used to decide whether a body is worth rendering. */
export function htmlTextLength(html: string | null | undefined): number {
  if (!html) return 0;
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length;
}
