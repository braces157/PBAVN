"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "pba-theme";
const THEME_EVENT = "pba-theme-change";

function readPreferredTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // Storage blocked in private contexts
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function getThemeSnapshot(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.dataset.theme;
  if (attr === "dark" || attr === "light") return attr;
  return readPreferredTheme();
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

function applyThemeToDom(next: Theme, disableTransitions = false) {
  const root = document.documentElement;
  if (disableTransitions) {
    root.dataset.themeSwitching = "1";
  }
  root.dataset.theme = next;
  root.style.colorScheme = next;
  if (disableTransitions) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        delete root.dataset.themeSwitching;
      });
    });
  }
}

function subscribeTheme(onStoreChange: () => void) {
  const onThemeEvent = () => onStoreChange();
  const syncFromPreference = () => {
    applyThemeToDom(readPreferredTheme());
    onStoreChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) {
      syncFromPreference();
    }
  };
  const onMediaChange = () => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "dark" || saved === "light") return;
    } catch {
      // Storage blocked in private contexts
    }
    syncFromPreference();
  };

  window.addEventListener(THEME_EVENT, onThemeEvent);
  window.addEventListener("storage", onStorage);
  window.addEventListener("pageshow", syncFromPreference);
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener("change", onMediaChange);

  return () => {
    window.removeEventListener(THEME_EVENT, onThemeEvent);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pageshow", syncFromPreference);
    media?.removeEventListener("change", onMediaChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  const toggle = () => {
    const current = getThemeSnapshot();
    const next: Theme = current === "dark" ? "light" : "dark";
    applyThemeToDom(next, true);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked in private contexts
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
