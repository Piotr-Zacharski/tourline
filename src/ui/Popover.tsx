import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { computePosition } from "../core/position";
import type { PositionResult } from "../core/position";
import type { StepRenderProps } from "./types";

const HIDDEN: PositionResult = { top: -9999, left: -9999, placement: "center" };

interface PopoverProps extends StepRenderProps {
  /** The target has not been measured yet: stay invisible rather than flash in the center. */
  pending?: boolean;
}

export const Popover = ({ active, targetRect, ui, pending = false, next, prev, skip }: PopoverProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [position, setPosition] = useState<PositionResult>(HIDDEN);
  const { step, shownIndex, shownTotal, isFirst, isLast } = active;
  const ready = position !== HIDDEN;
  const { labels } = ui;
  const placement = step.placement === undefined ? ui.placement : step.placement;
  const canGoBack = !isFirst && step.allowBack !== false;
  const canSkip = step.allowSkip !== false;

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null || pending) return;
    const size = { width: node.offsetWidth, height: node.offsetHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    setPosition(computePosition(targetRect, size, viewport, placement, ui.gap));
  }, [targetRect, step, placement, ui.gap, pending]);

  useEffect(() => {
    if (ready && ref.current !== null) ref.current.focus({ preventScroll: true });
  }, [step.id, ready]);

  return (
    <div
      ref={ref}
      className="tl-popover"
      data-placement={position.placement}
      data-ready={ready}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={{ top: position.top, left: position.left }}
    >
      {canSkip && (
        <button type="button" className="tl-close" onClick={skip} aria-label={labels.close}>
          ×
        </button>
      )}
      {ui.showProgress && <p className="tl-progress">{labels.progress(shownIndex + 1, shownTotal)}</p>}
      <h2 id={titleId} className="tl-title">
        {step.title}
      </h2>
      <div className="tl-content">{step.content}</div>
      {ui.showDots && (
        <div className="tl-dots" aria-hidden="true">
          {Array.from({ length: shownTotal }, (_, index) => (
            <span key={index} className="tl-dot" data-active={index === shownIndex} />
          ))}
        </div>
      )}
      <div className="tl-actions">
        {canGoBack ? (
          <button type="button" className="tl-button tl-button--ghost" onClick={prev}>
            {labels.back}
          </button>
        ) : (
          canSkip && (
            <button type="button" className="tl-button tl-button--ghost" onClick={skip}>
              {labels.skip}
            </button>
          )
        )}
        <button type="button" className="tl-button tl-button--primary" onClick={next}>
          {isLast ? labels.done : labels.next}
        </button>
      </div>
    </div>
  );
};
