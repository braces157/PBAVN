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
      <div className="relative overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 grid-field opacity-30" aria-hidden="true" />
        <div className="relative mx-auto max-w-[900px] px-4 pb-8 pt-8 sm:px-6">
          <nav className="flex items-center gap-2 text-[11.5px] text-fog-600" aria-label="Breadcrumb">
            <Link href="/news" className="transition-colors hover:text-fog-300">
              Newsroom
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-fog-400">Press release</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="tnum rounded border border-ink-700 px-2 py-0.5 text-[10.5px] uppercase tracking-[0.1em] text-fog-400">
              {fmtDate(article.date)}
            </span>
            <span className="tnum text-[10.5px] text-fog-600">{grouped(article.views)} views</span>
            {article.featured && (
              <span className="rounded bg-lime-400/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-lime-300">
                Featured
              </span>
            )}
          </div>

          <h1 className="mt-4 font-display text-[clamp(1.6rem,3.4vw,2.6rem)] font-bold leading-[1.12] tracking-tight text-fog-100">
            {article.title}
          </h1>
        </div>
      </div>

      <article className="mx-auto max-w-[900px] px-4 py-10 sm:px-6">
        {article.image && (
          /* The frame reserves the image's box so the article text does not
             jump when the picture arrives late. */
          <div className="mb-8 aspect-[16/9] overflow-hidden rounded-[14px] border border-ink-750 bg-ink-850 has-[span]:hidden">
            <SafeImage
              src={article.image}
              alt={article.title}
              loading="eager"
              className="h-full w-full object-contain"
              fallback={<span />}
            />
          </div>
        )}

        {hasBody ? (
          <div
            className="cms-body"
            // Sanitised above: no scripts, frames, handlers or javascript: URLs survive.
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <EmptyState
            title="No body text"
            description="This release was published without an article body. Open it on pbatour.org for the original."
          />
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-5">
          <TextLink href="/news">Back to the newsroom</TextLink>
          <a
            href="https://www.pbatour.org/en/media/press/index"
            target="_blank"
            rel="noreferrer noopener"
            className="text-[12.5px] text-fog-500 transition-colors hover:text-fog-200"
          >
            Original on pbatour.org ↗
          </a>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="eyebrow">More from the association</h2>
            <div className="mt-4 divide-y divide-ink-800 rounded-[14px] border border-ink-750 bg-ink-900">
              {related.map((item) => (
                <Link
                  key={item.SEQ}
                  href={`/news/${item.SEQ}`}
                  className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-ink-850"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-fog-100 group-hover:text-lime-300">
                      {stripTags(item.TITLE)}
                    </p>
                    <p className="tnum mt-0.5 text-[10.5px] text-fog-600">{fmtDate(item.VIEW_DATE)}</p>
                  </div>
                  <span aria-hidden="true" className="text-fog-600">
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
