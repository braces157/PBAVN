"use client";

import { useEffect, useRef, useState } from "react";
import { splitNewsHeadline } from "@/lib/news";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/components/ui/primitives";

export interface VideoCardItem {
  seq: string;
  title: string;
  alt: string;
  thumb: string | null;
  youtubeId: string | null;
  url: string;
}

export interface GalleryCardItem {
  seq: string;
  title: string;
  alt: string;
  image: string | null;
  dateLabel: string;
}

export function NewsVideoGrid({ items }: { items: VideoCardItem[] }) {
  const [active, setActive] = useState<VideoCardItem | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active?.youtubeId) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [active]);

  const closeDialog = () => {
    setActive(null);
    openerRef.current?.focus();
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((video, index) => {
          const { tag, headline } = splitNewsHeadline(video.title);
          const poster =
            video.thumb ??
            (video.youtubeId ? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg` : null);
          const watchUrl = video.youtubeId
            ? `https://www.youtube.com/watch?v=${video.youtubeId}`
            : video.url;

          return (
            <button
              key={video.seq}
              type="button"
              onClick={(e) => {
                if (video.youtubeId) {
                  openerRef.current = e.currentTarget;
                  setActive(video);
                } else if (watchUrl) {
                  window.open(watchUrl, "_blank", "noopener,noreferrer");
                }
              }}
              className="surface card-hover group flex flex-col overflow-hidden text-left"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-[var(--bar)]">
                <SafeImage
                  src={poster}
                  alt={video.alt}
                  loading={index < 6 ? "eager" : "lazy"}
                  className="h-full w-full object-cover object-[50%_25%] transition-transform duration-300 group-hover:scale-[1.03]"
                  fallback={
                    <div className="grid h-full w-full place-items-center bg-[var(--bar)]">
                      <span className="eyebrow">PBA TV</span>
                    </div>
                  }
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <span className="absolute left-2.5 top-2.5">
                  <span className={cn("tag", tag.cls)}>{tag.label}</span>
                </span>
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white ring-1 ring-white/30 backdrop-blur-xs transition-transform duration-200 group-hover:scale-110 group-hover:bg-[var(--link)]">
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" aria-hidden="true">
                      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                    </svg>
                  </span>
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-between gap-2 p-3.5">
                <p className="line-clamp-2 font-display text-[15px] font-bold leading-snug text-[var(--text)] group-hover:text-[var(--link)]">
                  {headline}
                </p>
                <span className="text-[11px] font-semibold text-[var(--muted)] group-hover:text-[var(--link)]">
                  Watch highlight →
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <dialog
        ref={dialogRef}
        aria-label={active?.title ?? "Video player"}
        onClose={closeDialog}
        onClick={(e) => {
          if (e.target === dialogRef.current) setActive(null);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-[920px] overflow-hidden rounded-[6px] border border-[var(--line-2)] bg-[var(--panel)] p-0 text-inherit shadow-2xl backdrop:bg-black/80"
      >
        {active && active.youtubeId && (
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--bar)] px-4 py-2.5">
              <p className="truncate font-display text-[15px] font-bold text-[var(--text)]">
                {splitNewsHeadline(active.title).headline}
              </p>
              <div className="flex shrink-0 items-center gap-3">
                <a
                  href={`https://www.youtube.com/watch?v=${active.youtubeId}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[11.5px] font-semibold text-[var(--link)] hover:underline"
                >
                  Open on YouTube ↗
                </a>
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  aria-label="Close video"
                  className="grid h-7 w-7 place-items-center rounded-[3px] border border-[var(--line)] bg-[var(--panel)] text-[14px] text-[var(--text-2)] hover:text-[var(--text)]"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${active.youtubeId}?autoplay=1&rel=0`}
                title={active.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

export function NewsGalleryGrid({ items }: { items: GalleryCardItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activeIndex !== null) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setActiveIndex((i) => (i === null ? null : (i + 1) % items.length));
      if (e.key === "ArrowLeft")
        setActiveIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, items.length]);

  const closeDialog = () => {
    setActiveIndex(null);
    openerRef.current?.focus();
  };

  const active = activeIndex !== null ? items[activeIndex] ?? null : null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((gallery, index) => {
          const { tag, headline } = splitNewsHeadline(gallery.title.replace(/_/g, " · "));
          return (
            <button
              key={gallery.seq}
              type="button"
              onClick={(e) => {
                openerRef.current = e.currentTarget;
                setActiveIndex(index);
              }}
              className="surface card-hover group flex flex-col overflow-hidden text-left"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--bar)]">
                <SafeImage
                  src={gallery.image}
                  alt={gallery.alt}
                  loading={index < 6 ? "eager" : "lazy"}
                  className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                  fallback={
                    <div className="grid h-full w-full place-items-center bg-[var(--bar)]">
                      <span className="eyebrow">Gallery</span>
                    </div>
                  }
                />
                <span className="absolute left-2.5 top-2.5">
                  <span className={cn("tag", tag.cls)}>{tag.label}</span>
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-between gap-1.5 p-3.5">
                <p className="line-clamp-2 font-display text-[14.5px] font-bold leading-snug text-[var(--text)] group-hover:text-[var(--link)]">
                  {headline}
                </p>
                <p className="tnum text-[11px] text-[var(--muted)]">{gallery.dateLabel}</p>
              </div>
            </button>
          );
        })}
      </div>

      <dialog
        ref={dialogRef}
        aria-label={active?.title ?? "Photo viewer"}
        onClose={closeDialog}
        onClick={(e) => {
          if (e.target === dialogRef.current) setActiveIndex(null);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-[960px] overflow-hidden rounded-[6px] border border-[var(--line-2)] bg-[var(--panel)] p-0 text-inherit shadow-2xl backdrop:bg-black/85"
      >
        {active && activeIndex !== null && (
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--bar)] px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-bold text-[var(--text)]">
                  {splitNewsHeadline(active.title.replace(/_/g, " · ")).headline}
                </p>
                <p className="tnum text-[11px] text-[var(--muted)]">
                  {active.dateLabel} · {activeIndex + 1} / {items.length}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveIndex((activeIndex - 1 + items.length) % items.length)}
                  aria-label="Previous photo"
                  className="grid h-7 w-7 place-items-center rounded-[3px] border border-[var(--line)] bg-[var(--panel)] text-[13px] text-[var(--text-2)] hover:text-[var(--text)]"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex((activeIndex + 1) % items.length)}
                  aria-label="Next photo"
                  className="grid h-7 w-7 place-items-center rounded-[3px] border border-[var(--line)] bg-[var(--panel)] text-[13px] text-[var(--text-2)] hover:text-[var(--text)]"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex(null)}
                  aria-label="Close photo"
                  className="ml-1 grid h-7 w-7 place-items-center rounded-[3px] border border-[var(--line)] bg-[var(--panel)] text-[14px] text-[var(--text-2)] hover:text-[var(--text)]"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex max-h-[75vh] items-center justify-center bg-black p-2">
              <SafeImage
                src={active.image}
                alt={active.alt}
                loading="eager"
                className="max-h-[72vh] w-auto max-w-full object-contain"
                fallback={<span className="py-20 text-sm text-[var(--muted)]">Photo unavailable</span>}
              />
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
