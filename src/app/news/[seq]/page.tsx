import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPressDetail, getPressList } from "@/lib/pba/api";
import { normalizeArticle } from "@/lib/normalize";
import { excerpt, fmtDate, grouped, stripTags } from "@/lib/format";
import { sanitizeCmsHtml, htmlTextLength } from "@/lib/sanitize";
import { SafeImage } from "@/components/ui/safe-image";
import { EmptyState, TextLink } from "@/components/ui/primitives";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ seq: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { seq } = await params;
  const article = await getPressDetail(seq);
  if (!article) return { title: "Article not found" };
  return {
    title: article.TITLE,
    description: excerpt(article.CONTENT, 180),
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { seq } = await params;
  const [raw, recent] = await Promise.all([getPressDetail(seq), getPressList(1, 5)]);
  if (!raw) notFound();

  const article = normalizeArticle(raw);
  const related = recent.list.filter((item) => item.SEQ !== article.seq).slice(0, 3);
  const body = sanitizeCmsHtml(article.body);
  const hasBody = htmlTextLength(article.body) > 0;

  return (
    <>
      <div className="border-b border-ink-800 bg-ink-900/60">
        <div className="mx-auto max-w-[900px] px-4 pb-6 pt-5 sm:px-6">
          <nav className="flex items-center gap-1.5 text-[11.5px] text-fog-500" aria-label="Breadcrumb">
            <Link href="/news" className="transition-colors hover:text-carom-300">
              Newsroom
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-fog-300">Press release</span>
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="tnum rounded border border-ink-700 bg-ink-900 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-fog-300">
              {fmtDate(article.date)}
            </span>
            <span className="tnum text-[10.5px] text-fog-550">{grouped(article.views)} views</span>
            {article.featured && (
              <span className="rounded bg-carom-400/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-carom-300">
                Featured
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-[clamp(1.4rem,2.8vw,2.15rem)] font-bold leading-[1.15] tracking-tight text-fog-100">
            {article.title}
          </h1>
        </div>
      </div>

      <article className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        {article.image && (
          <SafeImage
            src={article.image}
            alt={article.title}
            loading="eager"
            className="mb-6 w-full rounded-[8px] border border-ink-750 object-cover"
            fallback={<span />}
          />
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
              {related.map((item) => (
                <Link
                  key={item.SEQ}
                  href={`/news/${item.SEQ}`}
                  className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-ink-850"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-fog-100 group-hover:text-carom-300">
                      {stripTags(item.TITLE)}
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
