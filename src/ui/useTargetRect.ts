import { useEffect, useState } from "react";
import type { Rect } from "../core/position";
import { findAnchor } from "../react/anchor";

const toRect = (element: HTMLElement): Rect => {
  const box = element.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
};

const sameRect = (a: Rect | null, b: Rect | null) =>
  a !== null && b !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/**
 * Tracks the viewport rect of a `data-tour-id` element.
 * If the element is not rendered yet (lazy route, async data) it waits for it with a MutationObserver.
 */
export const useTargetRect = (target: string | undefined, stepKey: string): Rect | null => {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    setRect(null);
    if (target === undefined) return undefined;

    let element: HTMLElement | null = null;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (element === null || !element.isConnected) {
          element = null;
          setRect(null);
          return;
        }
        const next = toRect(element);
        setRect((previous) => (sameRect(previous, next) ? previous : next));
      });
    };

    const attach = (found: HTMLElement) => {
      element = found;
      found.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(found);
      }
      measure();
    };

    const initial = findAnchor(target);
    if (initial !== null) attach(initial);

    const mutationObserver = new MutationObserver(() => {
      if (element !== null && element.isConnected) return;
      const found = findAnchor(target);
      if (found !== null) attach(found);
      else measure();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      if (resizeObserver !== null) resizeObserver.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [target, stepKey]);

  return rect;
};
