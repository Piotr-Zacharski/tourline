import type { Rect } from "../core/position";

interface SpotlightProps {
  rect: Rect | null;
  padding?: number;
  onBackdropClick: () => void;
}

/** Dims the page and cuts a hole around the target. Without a target it is a plain backdrop. */
export const Spotlight = ({ rect, padding = 6, onBackdropClick }: SpotlightProps) => {
  if (rect === null) {
    return <div className="tl-backdrop" onClick={onBackdropClick} aria-hidden="true" />;
  }
  return (
    <>
      <div className="tl-backdrop tl-backdrop--clear" onClick={onBackdropClick} aria-hidden="true" />
      <div
        className="tl-spotlight"
        aria-hidden="true"
        style={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }}
      />
    </>
  );
};
