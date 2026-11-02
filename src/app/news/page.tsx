import type { Metadata } from "next";
import Link from "next/link";
import { getGalleries, getPressList, getVideos } from "@/lib/pba/api";
import { normalizeArticle } from "@/lib/normalize";
import { asset, isRealAsset } from "@/lib/pba/http";
import { excerpt, fmtDate, grouped, youtubeId } from "@/lib/format";
import { PageHeader } from "@/components/domain/filter-bar";
import { SafeImage } from "@/components/ui/safe-image";
import { EmptyState, Pagination, TabLinks } from "@/components/ui/primitives";

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

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab: Tab = params.tab === "videos" ? "videos" : params.tab === "gallery" ? "gallery" : "news";
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = 12;

  const [press, videos, galleries] = await Promise.all([
    getPressList(page, pageSize),
    getVideos(1, 12),
    getGalleries(1, 12),
  ]);

  const articles = press.list.map(normalizeArticle);
  const pageCount = Math.max(1, Math.ceil(press.total / pageSize));

  return (
    <>
      <PageHeader
        eyebrow="Media"
        title="The newsroom"
        description="Official announcements from the association, plus video and photography from the tour."
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

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        {tab === "news" && (
          <>
            {articles.length === 0 ? (
              <EmptyState title="No press releases" description="The association has not published anything yet." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {articles.map((article, index) => (
                  <Link
                    key={article.seq}
                    href={`/news/${article.seq}`}
                    className={`surface card-hover group flex flex-col overflow-hidden ${
                      index === 0 ? "md:col-span-2" : ""
                    }`}
                  >
                    <div className={`relative w-full overflow-hidden bg-ink-800 ${index === 0 ? "h-64" : "flex-1 min-h-44"}`}>
                      <SafeImage
                        src={article.image}
                        alt={article.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        fallback={
                          <div className="grid h-full w-full place-items-center">
                            <span className="eyebrow">PBA Newsroom</span>
                          </div>
                        }
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="tnum text-[10.5px] uppercase tracking-[0.1em] text-fog-600">
                          {fmtDate(article.date)}
                        </span>
                        {article.featured && (
                          <span className="rounded bg-lime-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-lime-300">
                            Featured
                          </span>
                        )}
                      </div>
                      <h2
                        className={`mt-2 line-clamp-2 font-display font-semibold leading-snug text-fog-100 group-hover:text-lime-300 ${
                          index === 0 ? "text-[19px]" : "text-[15px]"
                        }`}
                      >
                        {article.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-fog-500">
                        {excerpt(article.body, 140)}
                      </p>
                      <p className="tnum mt-3 text-[10.5px] text-fog-600">{grouped(article.views)} views</p>
                    </div>
                  </Link>
                ))}
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
            {videos.length === 0 ? (
              <EmptyState title="No videos published" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {videos.map((video) => {
                  const id = youtubeId(video.VIDEO_URL);
                  const thumb = isRealAsset(video.IMAGE_FILE_PATH) ? asset(video.IMAGE_FILE_PATH) : null;
                  return (
                    <a
                      key={video.SEQ}
                      href={video.VIDEO_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="surface card-hover group overflow-hidden"
                    >
                      <div className="relative aspect-video overflow-hidden bg-ink-800">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt={video.IMAGE_ALT || video.TITLE}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        ) : id ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                            alt={video.TITLE}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="grid h-full place-items-center">
                            <span className="eyebrow">PBA TV</span>
                          </div>
                        )}
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="grid h-11 w-11 place-items-center rounded-full bg-ink-950/70 text-lime-400 ring-1 ring-lime-400/40 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                            <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" aria-hidden="true">
                              <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                            </svg>
                          </span>
                        </span>
                      </div>
                      <div className="p-3.5">
                        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-fog-100 group-hover:text-lime-300">
                          {video.TITLE || video.VIDEO_NAME_EN || video.VIDEO_NAME}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "gallery" && (
          <>
            {galleries.length === 0 ? (
              <EmptyState title="No galleries published" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {galleries.map((gallery) => (
                  <figure key={gallery.SEQ} className="surface card-hover group overflow-hidden">
                    <div className="aspect-[4/3] overflow-hidden bg-ink-800">
                      {isRealAsset(gallery.IMAGE_FULL_PATH) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset(gallery.IMAGE_FULL_PATH) ?? ""}
                          alt={gallery.ALT || gallery.TITLE}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="grid h-full place-items-center">
                          <span className="eyebrow">Gallery</span>
                        </div>
                      )}
                    </div>
                    <figcaption className="p-3">
                      <p className="line-clamp-2 text-[12.5px] text-fog-200">{gallery.TITLE}</p>
                      <p className="tnum mt-1 text-[10.5px] text-fog-600">{fmtDate(gallery.VIEW_DATE)}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
