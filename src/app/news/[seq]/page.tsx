import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPressDetail, getPressList } from "@/lib/pba/api";
import { normalizeArticle } from "@/lib/normalize";
import { excerpt, fmtDate, grouped, stripTags } from "@/lib/format";
import { sanitizeCmsHtml, htmlTextLength } from "@/lib/sanitize";
import { translateArticleFull, translateKoToEn, translatePlainTitles } from "@/lib/translate";
import { ArrowRight, ExternalLink } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { splitNewsHeadline } from "@/lib/news";
import { EmptyState, TextLink, cn } from "@/components/ui/primitives";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ seq: string }>;
}

const loadArticle = cache(async (seq: string) => {
  const raw = await getPressDetail(seq);
  if (!raw) return null;
  const normalized = normalizeArticle(raw);
  const preSanitized = sanitizeCmsHtml(normalized.body);
  const { article, body } = await translateArticleFull(normalized, preSanitized);
  // Sanitize again after translation so translated HTML can never introduce unsafe markup.
  const safeBody = sanitizeCmsHtml(body);
  return { raw, article, body: safeBody };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { seq } = await params;
  const loaded = await loadArticle(seq);
  if (!loaded) return { title: "Article not found" };

  const fallbackTitle = stripTags(loaded.raw.TITLE) || "PBA News";
  const title = loaded.article.title.trim() || fallbackTitle;
  const rawExcerpt = excerpt(loaded.body || loaded.raw.CONTENT, 180);
  const description = (await translateKoToEn(rawExcerpt)).trim() || rawExcerpt || title;

  return {
    title,
    description,
    alternates: { canonical: `/news/${encodeURIComponent(seq)}` },
    openGraph: {
      title,
      description,
      type: "article",
      ...(loaded.article.date ? { publishedTime: loaded.article.date.toISOString() } : {}),
      ...(loaded.article.image ? { images: [{ url: loaded.article.image, alt: title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { seq } = await params;
  const loaded = await loadArticle(seq);
  if (!loaded) notFound();

  const { article, body } = loaded;
  const recent = await getPressList(1, 5);
  const related = recent.list.filter((item) => item.SEQ !== article.seq).slice(0, 3);
  const relatedTitles = await translatePlainTitles(related.map((item) => item.TITLE));

  const hasBody = htmlTextLength(body) > 0;
  const { tag, headline } = splitNewsHeadline(article.title);
  const readMinutes = Math.max(1, Math.round(htmlTextLength(body) / 900));

  return (
    <>
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-[900px] px-4 pb-6 pt-5 sm:px-6">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/news" className="transition-colors hover:text-foreground">
              Newsroom
            </Link>
            <span aria-hidden="true" className="text-border">/</span>
            <span className="text-foreground">Press release</span>
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn("tag", tag.cls)}>{tag.label}</span>
            <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
              {fmtDate(article.date)}
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{readMinutes} min read</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">· {grouped(article.views)} views</span>
            {article.featured && (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Featured
              </span>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
            {headline}
          </h1>
        </div>
      </div>

      <article className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        {article.image && (
          <div className="mb-6 overflow-hidden rounded-xl border border-border bg-secondary">
            <SafeImage
              src={article.image}
              alt={headline}
              loading="eager"
              className="mx-auto max-h-[500px] w-full object-contain"
              fallback={<span />}
            />
          </div>
        )}

        {hasBody ? (
          <div
            className="cms-body"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <EmptyState
            title="No body text"
            description="This release was published without an article body. Open it on pbatour.org for the original."
          />
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <TextLink href="/news">Back to newsroom</TextLink>
          <a
            href="https://www.pbatour.org/en/media/press/index"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Press archive on pbatour.org
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              More from the association
            </h2>
            <div className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
              {related.map((item, index) => (
                <Link
                  key={item.SEQ}
                  href={`/news/${item.SEQ}`}
                  className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50 hover:no-underline"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground group-hover:underline">
                      {relatedTitles[index] || stripTags(item.TITLE)}
                    </p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {fmtDate(item.VIEW_DATE)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
