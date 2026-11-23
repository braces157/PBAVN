"use client";

import { useCallback, useEffect, useState } from "react";

export interface FollowedPlayer {
  code: string;
  name: string;
  circuit?: string;
  nation?: string | null;
}

const STORAGE_KEY = "pba-following-v1";
const SYNC_EVENT = "pba-following-change";

function readStore(): FollowedPlayer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FollowedPlayer =>
        Boolean(item) && typeof item.code === "string" && typeof item.name === "string" && item.code.length > 0,
    );
  } catch {
    return [];
  }
}

function writeStore(list: FollowedPlayer[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 24)));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  } catch {
    // Storage unavailable (private mode or quota)
  }
}

export function useFollowing() {
  const [players, setPlayers] = useState<FollowedPlayer[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPlayers(readStore());
    setHydrated(true);

    const onSync = () => setPlayers(readStore());
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener("storage", onSync);
    };
  }, []);

  const isFollowing = useCallback(
    (code: string | null | undefined) => Boolean(code && players.some((p) => p.code === code)),
    [players],
  );

  const toggle = useCallback((player: FollowedPlayer) => {
    const current = readStore();
    const exists = current.some((p) => p.code === player.code);
    const next = exists ? current.filter((p) => p.code !== player.code) : [player, ...current];
    writeStore(next);
    setPlayers(next);
  }, []);

  const remove = useCallback((code: string) => {
    const next = readStore().filter((p) => p.code !== code);
    writeStore(next);
    setPlayers(next);
  }, []);

  const clear = useCallback(() => {
    writeStore([]);
    setPlayers([]);
  }, []);

  return { players, hydrated, isFollowing, toggle, remove, clear };
}
