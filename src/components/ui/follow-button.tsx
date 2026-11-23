"use client";

import { Star } from "lucide-react";
import { useFollowing, type FollowedPlayer } from "@/lib/following";
import { cn } from "@/lib/utils";

export function FollowButton({
  player,
  compact = false,
  className,
}: {
  player: FollowedPlayer;
  compact?: boolean;
  className?: string;
}) {
  const { isFollowing, toggle } = useFollowing();
  const pinned = isFollowing(player.code);
  const label = pinned ? `Unfollow ${player.name}` : `Follow ${player.name}`;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(player);
      }}
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors hover:bg-accent",
        pinned ? "text-amber-500" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Star className={`${compact ? "size-3.5" : "size-4"} ${pinned ? "fill-current" : ""}`} />
    </button>
  );
}
