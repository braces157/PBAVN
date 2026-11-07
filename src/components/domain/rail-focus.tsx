"use client";

import { useEffect } from "react";

/**
 * Scrolls the nearest scroll container so the day rail's today row is visible.
 *
 * The rail is a fixed-height scroll box that starts a week before today, so on a
 * 900 px screen the selected day sits just below the fold — the reader has to
 * scroll before they can see which day the page is on. A one-pixel correction on
 * mount fixes that, and only when the row is genuinely out of view, so the rail
 * stays where a reader leaves it.
 *
 * `scrollIntoView` is deliberately not used: it scrolls every ancestor,
 * including the document, which would yank the page down on load.
 */
export function RailFocus({
  id,
  offset = 72,
  axis = "y",
}: {
  id: string;
  offset?: number;
  /** `x` for the phone strip, which scrolls sideways to the selected day. */
  axis?: "x" | "y";
}) {
  useEffect(() => {
    const target = document.getElementById(id);
    if (!target) return;
    const scroller = target.closest<HTMLElement>("[data-rail-scroll]");
    if (!scroller) return;

    if (axis === "x") {
      const targetLeft =
        target.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
      const visible =
        targetLeft >= scroller.scrollLeft && targetLeft <= scroller.scrollLeft + scroller.clientWidth - 24;
      if (!visible) scroller.scrollLeft = Math.max(0, targetLeft - offset);
      return;
    }

    const targetTop =
      target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const visible = targetTop >= scroller.scrollTop && targetTop <= scroller.scrollTop + scroller.clientHeight - 24;
    if (!visible) scroller.scrollTop = Math.max(0, targetTop - offset);
  }, [id, offset, axis]);

  return null;
}
