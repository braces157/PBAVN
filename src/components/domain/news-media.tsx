"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Play, X } from "lucide-react";
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

          const cardBody = (
            <>
              <div className="relative aspect-video w-full overflow-hidden bg-secondary">
                <SafeImage
                  src={poster}
                  alt={video.alt}
                  loading={index < 6 ? "eager" : "lazy"}
                  className="h-full w-full object-cover object-[50%_25%] transition-transform duration-300 group-hover:scale-[1.03]"
                  fallback={
                    <div className="grid h-full w-full place-items-center bg-secondary">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">PBA TV</span>
                    </div>
                  }
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <span className="absolute left-2.5 top-2.5">
                  <span className={cn("tag", tag.cls)}>{tag.label}</span>
                </span>
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-zinc-950/80 text-white ring-1 ring-white/25 backdrop-blur-xs transition-transform duration-200 group-hover:scale-110">
                    <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
                  </span>
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-between gap-2 p-4">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:underline">
                  {headline}
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  {video.youtubeId ? "Watch highlight" : "Open video"}
                  {video.youtubeId ? (
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
              </div>
            </>
          );

          if (!video.youtubeId && watchUrl) {
            return (
              <a
                key={video.seq}
                href={watchUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-foreground/20 hover:no-underline"
              >
                {cardBody}
              </a>
            );
          }

          return (
            <button
              key={video.seq}
              type="button"
              onClick={(e) => {
                if (video.youtubeId) {
                  openerRef.current = e.currentTarget;
                  setActive(video);
                }
              }}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-foreground/20"
            >
              {cardBody}
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
        className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-[920px] overflow-y-auto rounded-xl border border-border bg-card p-0 text-inherit shadow-2xl backdrop:bg-black/80"
      >
        {active && active.youtubeId && (
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3">
              <p className="truncate text-sm font-semibold text-foreground">
                {splitNewsHeadline(active.title).headline}
              </p>
              <div className="flex shrink-0 items-center gap-3">
                <a
                  href={`https://www.youtube.com/watch?v=${active.youtubeId}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  YouTube
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  aria-label="Close video"
                  title="Close video"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
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
  const isOpen = activeIndex !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIndex((i) => (i === null ? null : (i + 1) % items.length));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, items.length]);

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
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-foreground/20"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                <SafeImage
                  src={gallery.image}
                  alt={gallery.alt}
                  loading={index < 6 ? "eager" : "lazy"}
                  className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                  fallback={
                    <div className="grid h-full w-full place-items-center bg-secondary">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Gallery</span>
                    </div>
                  }
                />
                <span className="absolute left-2.5 top-2.5">
                  <span className={cn("tag", tag.cls)}>{tag.label}</span>
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-between gap-1.5 p-4">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:underline">
                  {headline}
                </p>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{gallery.dateLabel}</p>
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
        className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-[960px] overflow-y-auto rounded-xl border border-border bg-card p-0 text-inherit shadow-2xl backdrop:bg-black/85"
      >
        {active && activeIndex !== null && (
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {splitNewsHeadline(active.title.replace(/_/g, " · ")).headline}
                </p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="polite">
                  {active.dateLabel} · {activeIndex + 1} / {items.length}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    items.length > 0 && setActiveIndex((activeIndex - 1 + items.length) % items.length)
                  }
                  aria-label="Previous photo"
                  title="Previous photo"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => items.length > 0 && setActiveIndex((activeIndex + 1) % items.length)}
                  aria-label="Next photo"
                  title="Next photo"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex(null)}
                  aria-label="Close photo"
                  title="Close photo"
                  className="ml-1 grid h-7 w-7 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex max-h-[75vh] items-center justify-center bg-black p-2">
              <SafeImage
                key={active.seq}
                src={active.image}
                alt={active.alt}
                loading="eager"
                className="max-h-[72vh] w-auto max-w-full object-contain"
                fallback={<span className="py-20 text-sm text-muted-foreground">Photo unavailable</span>}
              />
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
