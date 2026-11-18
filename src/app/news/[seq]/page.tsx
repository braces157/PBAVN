import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPressDetail, getPressList } from "@/lib/pba/api";
import { normalizeArticle } from "@/lib/normalize";
import { excerpt, fmtDate, grouped, stripTags } from "@/lib/format";
import { sanitizeCmsHtml, htmlTextLength } from "@/lib/sanitize";
import { translateArticleFull, translateKoToEn, translatePlainTitles } from "@/lib/translate";
import { SafeImage } from "@/components/ui/safe-image";
import { splitNewsHeadline } from "@/lib/news";
import { EmptyState, TextLink, cn } from "@/components/ui/primitives";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ seq: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { seq } = await params;
  const article = await getPressDetail(seq);
  if (!article) return { title: "Article not found" };
  const [title, description] = await Promise.all([
    translateKoToEn(stripTags(article.TITLE)),
    translateKoToEn(excerpt(article.CONTENT, 180)),
  ]);
  return {
    title,
    description,
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { seq } = await params;
  const [raw, recent] = await Promise.all([getPressDetail(seq), getPressList(1, 5)]);
  if (!raw) notFound();

  const normalized = normalizeArticle(raw);
  const related = recent.list.filter((item) => item.SEQ !== normalized.seq).slice(0, 3);
  const [{ article, body }, relatedTitles] = await Promise.all([
    translateArticleFull(normalized, sanitizeCmsHtml(normalized.body)),
    translatePlainTitles(related.map((item) => item.TITLE)),
  ]);
  const hasBody = htmlTextLength(body) > 0;
  const { tag, headline } = splitNewsHeadline(article.title);
  const readMinutes = Math.max(1, Math.round(htmlTextLength(body) / 900));

  return (
    <>
      <div className="border-b border-[var(--line)] bg-[var(--bar)]">
        <div className="mx-auto max-w-[900px] px-4 pb-6 pt-5 sm:px-6">
          <nav className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]" aria-label="Breadcrumb">
            <Link href="/news" className="transition-colors hover:text-[var(--link)]">
              Newsroom
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[var(--text-2)]">Press release</span>
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn("tag", tag.cls)}>{tag.label}</span>
            <span className="tnum rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-2)]">
              {fmtDate(article.date)}
            </span>
            <span className="tnum text-[11px] text-[var(--muted)]">{readMinutes} min read</span>
            <span className="tnum text-[11px] text-[var(--muted)]">· {grouped(article.views)} views</span>
            {article.featured && (
              <span className="rounded bg-[var(--yellow)]/20 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--yellow-ink)]">
                Featured
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-[clamp(1.45rem,2.9vw,2.2rem)] font-bold leading-[1.15] tracking-tight text-[var(--text)]">
            {headline}
          </h1>
        </div>
      </div>

      <article className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        {article.image && (
          <div className="mb-6 overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--bar)]">
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

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-4">
          <TextLink href="/news">Back to newsroom</TextLink>
          <a
            href="https://www.pbatour.org/en/media/press/index"
            target="_blank"
            rel="noreferrer noopener"
            className="text-[12px] font-medium text-fog-450 transition-colors hover:text-carom-300"
          >
            Original on pbatour.org ↗
          </a>
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="eyebrow">More from the association</h2>
            <div className="mt-3 divide-y divide-ink-800 rounded-[8px] border border-ink-750 bg-ink-900">
              {related.map((item, index) => (
                <Link
                  key={item.SEQ}
                  href={`/news/${item.SEQ}`}
                  className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-ink-850"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-fog-100 group-hover:text-carom-300">
                      {relatedTitles[index] || stripTags(item.TITLE)}
                    </p>
                    <p className="tnum mt-0.5 text-[10.5px] text-fog-550">{fmtDate(item.VIEW_DATE)}</p>
                  </div>
                  <span aria-hidden="true" className="text-fog-550 group-hover:text-carom-300">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
