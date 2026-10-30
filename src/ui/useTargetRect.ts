import { useEffect, useState } from "react";
import type { Rect } from "../core/position";
import { findAnchor } from "../react/anchor";

export interface TargetRect {
  /** Last measured rect. While `pending` it still belongs to the previous step. */
  rect: Rect | null;
  /** Step key the rect was measured for. */
  rectKey: string;
  /**
   * True until the current step's target has been measured (and scrolled into view) for the first time,
   * and while a target that is not rendered yet is being waited for.
   */
  pending: boolean;
}

interface Measured {
  key: string;
  rect: Rect | null;
  waiting: boolean;
}

/** Frames the rect must stay put before a scroll counts as finished, and the cap for slow scrolls. */
const SETTLE_FRAMES = 3;
const MAX_SETTLE_FRAMES = 60;

const toRect = (element: HTMLElement): Rect => {
  const box = element.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
};

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === null || b === null
    ? a === b
    : a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

const inViewport = (rect: Rect) =>
  rect.top >= 0 &&
  rect.left >= 0 &&
  rect.top + rect.height <= window.innerHeight &&
  rect.left + rect.width <= window.innerWidth;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Tracks the viewport rect of a `data-tour-id` element.
 * If the element is not rendered yet (lazy route, async data) it waits for it with a MutationObserver,
 * for up to `timeout` ms; after that the step is reported with a null rect and shows centered.
 * The previous rect is kept until the new one is measured, so step changes never flash an empty frame.
 * An off-screen target is scrolled into view first and reported only once the scroll has settled.
 */
export const useTargetRect = (target: string | undefined, stepKey: string, timeout: number): TargetRect => {
  const [measured, setMeasured] = useState<Measured>({ key: "", rect: null, waiting: false });

  useEffect(() => {
    const commit = (next: Rect | null, isWaiting = false) =>
      setMeasured((previous) =>
        previous.key === stepKey && previous.waiting === isWaiting && sameRect(previous.rect, next)
          ? previous
          : { key: stepKey, rect: next, waiting: isWaiting },
      );

    if (target === undefined) {
      commit(null);
      return undefined;
    }

    let element: HTMLElement | null = null;
    let frame = 0;
    let settling = false;
    let waiting = false;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    let resizeObserver: ResizeObserver | null = null;

    const measure = () => {
      if (settling) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (element === null || !element.isConnected) {
          element = null;
          commit(null, waiting);
          return;
        }
        commit(toRect(element));
      });
    };

    // Waits until the target stops moving after scrollIntoView, then reports its final rect once.
    const settle = (found: HTMLElement) => {
      settling = true;
      let last = toRect(found);
      let still = 0;
      let frames = 0;
      const tick = () => {
        const next = toRect(found);
        still = sameRect(last, next) ? still + 1 : 0;
        last = next;
        frames += 1;
        if (still >= SETTLE_FRAMES || frames >= MAX_SETTLE_FRAMES) {
          settling = false;
          measure();
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const attach = (found: HTMLElement) => {
      clearTimeout(waitTimer);
      waiting = false;
      element = found;
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(found);
      }
      if (inViewport(toRect(found))) {
        measure();
        return;
      }
      found.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      settle(found);
    };

    const initial = findAnchor(target);
    if (initial !== null) {
      attach(initial);
    } else {
      // Dim the page without a hole and keep the popover hidden until the target renders.
      waiting = true;
      commit(null, true);
      waitTimer = setTimeout(() => {
        waiting = false;
        commit(null);
      }, timeout);
    }

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
      clearTimeout(waitTimer);
      mutationObserver.disconnect();
      if (resizeObserver !== null) resizeObserver.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [target, stepKey, timeout]);

  return { rect: measured.rect, rectKey: measured.key, pending: measured.key !== stepKey || measured.waiting };
};
