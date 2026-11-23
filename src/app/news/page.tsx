import type { Metadata } from "next";
import Link from "next/link";
import { getGalleries, getPressList, getVideos } from "@/lib/pba/api";
import { getRequestFailures, trackFailures } from "@/lib/pba/failures";
import { normalizeArticle } from "@/lib/normalize";
import { translateArticleSummaries, translatePlainTitles } from "@/lib/translate";
import { asset, isRealAsset } from "@/lib/pba/http";
import { eventArtUrl } from "@/lib/event-art";
import { fmtDate, grouped, safeHttpUrl, youtubeId } from "@/lib/format";
import { PageHeader } from "@/components/domain/filter-bar";
import { splitNewsHeadline } from "@/lib/news";
import {
  NewsGalleryGrid,
  NewsVideoGrid,
  type GalleryCardItem,
  type VideoCardItem,
} from "@/components/domain/news-media";
import { ArrowRight } from "lucide-react";
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
  const requestedPage = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const pageSize = 12;

  const data = await trackFailures(async () => {
    const [press, videos, galleries] = await Promise.all([
      tab === "news" ? getPressList(requestedPage, pageSize) : Promise.resolve({ list: [], total: 0 }),
      tab === "videos" ? getVideos(1, 24) : Promise.resolve([]),
      tab === "gallery" ? getGalleries(1, 24) : Promise.resolve([]),
    ]);

    const initialPageCount = Math.max(1, Math.ceil(press.total / pageSize));
    const page = tab === "news" ? Math.min(requestedPage, initialPageCount) : 1;
    const effectivePress =
      tab === "news" && page !== requestedPage ? await getPressList(page, pageSize) : press;
    const pageCount = Math.max(1, Math.ceil(effectivePress.total / pageSize));

    const [articles, videoTitles, galleryTitles] = await Promise.all([
      tab === "news" ? translateArticleSummaries(effectivePress.list.map(normalizeArticle), 160) : Promise.resolve([]),
      tab === "videos"
        ? translatePlainTitles(videos.map((v) => v.TITLE || v.VIDEO_NAME_EN || v.VIDEO_NAME || ""))
        : Promise.resolve([]),
      tab === "gallery"
        ? translatePlainTitles(galleries.map((g) => g.TITLE || ""))
        : Promise.resolve([]),
    ]);

    return {
      press: effectivePress,
      videos,
      galleries,
      articles,
      videoTitles,
      galleryTitles,
      page,
      pageCount,
      failures: getRequestFailures(),
    };
  });

  const { press, videos, galleries, articles, videoTitles, galleryTitles, page, pageCount, failures } = data;

  const videoItems: VideoCardItem[] = videos.map((video, index) => {
    const title = videoTitles[index] || video.TITLE || video.VIDEO_NAME_EN || video.VIDEO_NAME || "PBA TV";
    const id = youtubeId(video.VIDEO_URL);
    const rawThumb = isRealAsset(video.IMAGE_FILE_PATH) ? asset(video.IMAGE_FILE_PATH) : null;
    return {
      seq: video.SEQ,
      title,
      alt: safeAlt(video.IMAGE_ALT, title),
      thumb: rawThumb ? (eventArtUrl(rawThumb, 768) ?? rawThumb) : null,
      youtubeId: id,
      url: safeHttpUrl(video.VIDEO_URL) ?? "",
    };
  });

  const galleryItems: GalleryCardItem[] = galleries.map((gallery, index) => {
    const title = galleryTitles[index] || gallery.TITLE || "PBA Gallery";
    const rawImg = isRealAsset(gallery.IMAGE_FULL_PATH) ? asset(gallery.IMAGE_FULL_PATH) : null;
    return {
      seq: gallery.SEQ,
      title,
      alt: safeAlt(gallery.ALT, title.replace(/_/g, " ")),
      image: rawImg ? (eventArtUrl(rawImg, 1200) ?? rawImg) : null,
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
        failures={failures}
      >
        <TabLinks
          active={tab === "news" ? "/news" : `/news?tab=${tab}`}
          items={[
            { href: "/news", label: "Press", count: tab === "news" && press.total > 0 ? press.total : undefined },
            { href: "/news?tab=videos", label: "PBA TV" },
            { href: "/news?tab=gallery", label: "Galleries" },
          ]}
        />
      </PageHeader>

      <div className="wrap py-5">
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
  const imgSrc = article.image ? (eventArtUrl(article.image, 960) ?? article.image) : null;
  return (
    <Link
      href={`/news/${article.seq}`}
      className="group grid overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20 hover:no-underline lg:grid-cols-[1.35fr_1fr]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary">
        <SafeImage
          src={imgSrc}
          alt={headline}
          loading="eager"
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
          fallback={
            <div className="grid h-full w-full place-items-center bg-secondary">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">PBA Newsroom</span>
            </div>
          }
        />
      </div>
      <div className="flex flex-col justify-between gap-4 p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("tag", tag.cls)}>{tag.label}</span>
            {article.featured && (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Featured
              </span>
            )}
            <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
              {fmtDate(article.date)}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-foreground group-hover:underline sm:text-2xl">
            {headline}
          </h2>
          {article.summary && (
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {article.summary}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
          <span className="font-mono tabular-nums text-muted-foreground">{grouped(article.views)} views</span>
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            Read release
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
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
  const imgSrc = article.image ? (eventArtUrl(article.image, 640) ?? article.image) : null;
  return (
    <Link
      href={`/news/${article.seq}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20 hover:no-underline"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary">
        <SafeImage
          src={imgSrc}
          alt={headline}
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          fallback={
            <div className="grid h-full w-full place-items-center bg-secondary">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">PBA Newsroom</span>
            </div>
          }
        />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("tag", tag.cls)}>{tag.label}</span>
            {article.featured && (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Featured
              </span>
            )}
            <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
              {fmtDate(article.date)}
            </span>
          </div>
          <h2
            className={cn(
              "mt-2 line-clamp-2 font-semibold leading-snug text-foreground group-hover:underline",
              variant === "featured" ? "text-lg" : "text-[15px]",
            )}
          >
            {headline}
          </h2>
          {article.summary && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {article.summary}
            </p>
          )}
        </div>
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{grouped(article.views)} views</p>
      </div>
    </Link>
  );
}
