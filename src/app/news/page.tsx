import type { Metadata } from "next";
import Link from "next/link";
import { getGalleries, getPressList, getVideos } from "@/lib/pba/api";
import { normalizeArticle } from "@/lib/normalize";
import { translateArticleSummaries, translatePlainTitles } from "@/lib/translate";
import { asset, isRealAsset } from "@/lib/pba/http";
import { fmtDate, grouped, youtubeId } from "@/lib/format";
import { PageHeader } from "@/components/domain/filter-bar";
import { splitNewsHeadline } from "@/lib/news";
import {
  NewsGalleryGrid,
  NewsVideoGrid,
  type GalleryCardItem,
  type VideoCardItem,
} from "@/components/domain/news-media";
import { SafeImage } from "@/components/ui/safe-image";
import { EmptyState, Pagination, TabLinks, cn } from "@/components/ui/primitives";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Newsroom",
  description:
    "Press releases, video and photo galleries from the Professional Billiards Association, in one feed.",
};

type Tab = "news" | "videos" | "gallery";

interface PageProps {
  searchParams: Promise<{ tab?: string; page?: string }>;
}

function safeAlt(candidate: string | null | undefined, fallback: string): string {
  const clean = (candidate ?? "").trim();
  if (!clean || /^\d+$/.test(clean)) return fallback;
  return clean;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab: Tab = params.tab === "videos" ? "videos" : params.tab === "gallery" ? "gallery" : "news";
  const rawPage = Number(params.page ?? 1);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const pageSize = 12;

  const [press, videos, galleries] = await Promise.all([
    getPressList(page, pageSize),
    getVideos(1, 12),
    getGalleries(1, 12),
  ]);

  const [articles, videoTitles, galleryTitles] = await Promise.all([
    tab === "news" ? translateArticleSummaries(press.list.map(normalizeArticle), 160) : Promise.resolve([]),
    tab === "videos"
      ? translatePlainTitles(videos.map((v) => v.TITLE || v.VIDEO_NAME_EN || v.VIDEO_NAME || ""))
      : Promise.resolve([]),
    tab === "gallery"
      ? translatePlainTitles(galleries.map((g) => g.TITLE || ""))
      : Promise.resolve([]),
  ]);
  const pageCount = Math.max(1, Math.ceil(press.total / pageSize));

  const videoItems: VideoCardItem[] = videos.map((video, index) => {
    const title = videoTitles[index] || video.TITLE || video.VIDEO_NAME_EN || video.VIDEO_NAME || "PBA TV";
    const id = youtubeId(video.VIDEO_URL);
    return {
      seq: video.SEQ,
      title,
      alt: safeAlt(video.IMAGE_ALT, title),
      thumb: isRealAsset(video.IMAGE_FILE_PATH) ? asset(video.IMAGE_FILE_PATH) : null,
      youtubeId: id,
      url: video.VIDEO_URL,
    };
  });

  const galleryItems: GalleryCardItem[] = galleries.map((gallery, index) => {
    const title = galleryTitles[index] || gallery.TITLE || "PBA Gallery";
    return {
      seq: gallery.SEQ,
      title,
      alt: safeAlt(gallery.ALT, title.replace(/_/g, " ")),
      image: isRealAsset(gallery.IMAGE_FULL_PATH) ? asset(gallery.IMAGE_FULL_PATH) : null,
      dateLabel: fmtDate(gallery.VIEW_DATE),
    };
  });

  const showEditorialLead = page === 1 && articles.length >= 4;
  const leadArticle = showEditorialLead ? articles[0] : null;
  const secondaryArticles = showEditorialLead ? articles.slice(1, 3) : [];
  const gridArticles = showEditorialLead ? articles.slice(3) : articles;

  return (
    <>
      <PageHeader
        eyebrow="Media"
        title="Newsroom"
        description="Official announcements, PBA TV highlights, and tour photography."
      >
        <TabLinks
          active={tab === "news" ? "/news" : `/news?tab=${tab}`}
          items={[
            { href: "/news", label: "Press", count: press.total },
            { href: "/news?tab=videos", label: "PBA TV", count: videos.length },
            { href: "/news?tab=gallery", label: "Galleries", count: galleries.length },
          ]}
        />
      </PageHeader>

      <div className="mx-auto max-w-[1300px] px-3 py-5">
        {tab === "news" && (
          <>
            {articles.length === 0 ? (
              <EmptyState title="No press releases" description="The association has not published anything yet." />
            ) : (
              <div className="space-y-4">
                {leadArticle && (
                  <LeadPressCard article={leadArticle} />
                )}

                {secondaryArticles.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {secondaryArticles.map((article) => (
                      <PressCard key={article.seq} article={article} variant="featured" />
                    ))}
                  </div>
                )}

                {gridArticles.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {gridArticles.map((article) => (
                      <PressCard key={article.seq} article={article} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <Pagination
              page={page}
              pageCount={pageCount}
              buildHref={(nextPage) => (nextPage > 1 ? `/news?page=${nextPage}` : "/news")}
            />
          </>
        )}

        {tab === "videos" && (
          <>
            {videoItems.length === 0 ? (
              <EmptyState title="No videos published" />
            ) : (
              <NewsVideoGrid items={videoItems} />
            )}
          </>
        )}

        {tab === "gallery" && (
          <>
            {galleryItems.length === 0 ? (
              <EmptyState title="No galleries published" />
            ) : (
              <NewsGalleryGrid items={galleryItems} />
            )}
          </>
        )}
      </div>
    </>
  );
}

type SummarizedArticle = Awaited<ReturnType<typeof translateArticleSummaries>>[number];

function LeadPressCard({ article }: { article: SummarizedArticle }) {
  const { tag, headline } = splitNewsHeadline(article.title);
  return (
    <Link
      href={`/news/${article.seq}`}
      className="surface card-hover group grid overflow-hidden lg:grid-cols-[1.35fr_1fr]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bar)]">
        <SafeImage
          src={article.image}
          alt={headline}
          loading="eager"
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
          fallback={
            <div className="grid h-full w-full place-items-center bg-[var(--bar)]">
              <span className="eyebrow">PBA Newsroom</span>
            </div>
          }
        />
      </div>
      <div className="flex flex-col justify-between gap-4 p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("tag", tag.cls)}>{tag.label}</span>
            {article.featured && (
              <span className="rounded-[2px] bg-[var(--yellow)]/20 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--yellow-ink)]">
                Featured
              </span>
            )}
            <span className="tnum text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">
              {fmtDate(article.date)}
            </span>
          </div>
          <h2 className="mt-3 font-display text-[22px] font-bold leading-[1.15] tracking-tight text-[var(--text)] group-hover:text-[var(--link)] sm:text-[26px]">
            {headline}
          </h2>
          {article.summary && (
            <p className="mt-3 line-clamp-3 text-[13.5px] leading-relaxed text-[var(--text-2)]">
              {article.summary}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--line)] pt-3 text-[11.5px]">
          <span className="tnum text-[var(--muted)]">{grouped(article.views)} views</span>
          <span className="font-semibold text-[var(--link)] group-hover:underline">
            Read release →
          </span>
        </div>
      </div>
    </Link>
  );
}

function PressCard({
  article,
  variant = "standard",
}: {
  article: SummarizedArticle;
  variant?: "featured" | "standard";
}) {
  const { tag, headline } = splitNewsHeadline(article.title);
  return (
    <Link
      href={`/news/${article.seq}`}
      className="surface card-hover group flex flex-col overflow-hidden"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bar)]">
        <SafeImage
          src={article.image}
          alt={headline}
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          fallback={
            <div className="grid h-full w-full place-items-center bg-[var(--bar)]">
              <span className="eyebrow">PBA Newsroom</span>
            </div>
          }
        />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("tag", tag.cls)}>{tag.label}</span>
            {article.featured && (
              <span className="rounded-[2px] bg-[var(--yellow)]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--yellow-ink)]">
                Featured
              </span>
            )}
            <span className="tnum text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">
              {fmtDate(article.date)}
            </span>
          </div>
          <h2
            className={cn(
              "mt-2 line-clamp-2 font-display font-bold leading-snug text-[var(--text)] group-hover:text-[var(--link)]",
              variant === "featured" ? "text-[18px]" : "text-[15.5px]",
            )}
          >
            {headline}
          </h2>
          {article.summary && (
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-[var(--text-2)]">
              {article.summary}
            </p>
          )}
        </div>
        <p className="tnum text-[10.5px] text-[var(--muted)]">{grouped(article.views)} views</p>
      </div>
    </Link>
  );
}
