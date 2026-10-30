import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import type { Rect } from "../core/position";

interface SpotlightProps {
  rect: Rect | null;
  /** Step the rect belongs to. A new key glides the hole over; otherwise it sticks to the target. */
  rectKey: string;
  padding: number;
  /** Clicks inside the hole reach the target instead of the backdrop. */
  interactive: boolean;
  /** Omit to make the backdrop inert. */
  onBackdropClick?: () => void;
}

/** Matches the .tl-spotlight transition, plus a little slack. */
const GLIDE_MS = 260;

const contains = (hole: Rect, x: number, y: number) =>
  x >= hole.left && x <= hole.left + hole.width && y >= hole.top && y <= hole.top + hole.height;

/** Covers the whole viewport except `hole`, so pointer events inside the hole fall through to the page. */
const clipAround = (hole: Rect) => {
  const left = `${hole.left}px`;
  const right = `${hole.left + hole.width}px`;
  const top = `${hole.top}px`;
  const bottom = `${hole.top + hole.height}px`;
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${left} ${top}, ${right} ${top}, ${right} ${bottom}, ${left} ${bottom}, ${left} ${top})`;
};

/** Dims the page and cuts a hole around the target. Without a target it is a plain backdrop. */
export const Spotlight = ({ rect, rectKey, padding, interactive, onBackdropClick }: SpotlightProps) => {
  const [settledKey, setSettledKey] = useState(rectKey);
  const gliding = rectKey !== settledKey;

  useEffect(() => {
    const timer = setTimeout(() => setSettledKey(rectKey), GLIDE_MS);
    return () => clearTimeout(timer);
  }, [rectKey]);

  const hole =
    rect === null
      ? null
      : {
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        };

  // A click on the highlighted element is not a request to leave the tour.
  const onClick = (event: MouseEvent) => {
    if (onBackdropClick === undefined) return;
    if (hole !== null && contains(hole, event.clientX, event.clientY)) return;
    onBackdropClick();
  };

  // The backdrop stays the same element in both modes so switching steps does not remount it and replay its fade.
  return (
    <>
      <div
        className={hole === null ? "tl-backdrop" : "tl-backdrop tl-backdrop--clear"}
        style={hole !== null && interactive ? { clipPath: clipAround(hole) } : undefined}
        onClick={onClick}
        aria-hidden="true"
      />
      {hole !== null && <div className="tl-spotlight" data-gliding={gliding} aria-hidden="true" style={hole} />}
    </>
  );
};
