"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.dataset.themeSwitching = "1";
    setTheme(next);
    root.dataset.theme = next;
    root.style.colorScheme = next;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        delete root.dataset.themeSwitching;
      });
    });
    try {
      localStorage.setItem("pba-theme", next);
    } catch {
      // Storage blocked in private contexts
    }
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
