import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { computePosition } from "../core/position";
import type { PositionResult } from "../core/position";
import type { StepRenderProps } from "./types";

const HIDDEN: PositionResult = { top: -9999, left: -9999, placement: "center" };

export const Popover = ({ active, targetRect, next, prev, skip }: StepRenderProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [position, setPosition] = useState<PositionResult>(HIDDEN);
  const { step, stepIndex, totalSteps, isFirst, isLast } = active;

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const size = { width: node.offsetWidth, height: node.offsetHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    setPosition(computePosition(targetRect, size, viewport, step.placement));
  }, [targetRect, step]);

  useEffect(() => {
    if (ref.current !== null) ref.current.focus({ preventScroll: true });
  }, [step.id]);

  return (
    <div
      ref={ref}
      className="tl-popover"
      data-placement={position.placement}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={{ top: position.top, left: position.left }}
    >
      <button type="button" className="tl-close" onClick={skip} aria-label="Close tour">
        ×
      </button>
      <p className="tl-progress">
        {stepIndex + 1} / {totalSteps}
      </p>
      <h2 id={titleId} className="tl-title">
        {step.title}
      </h2>
      <div className="tl-content">{step.content}</div>
      <div className="tl-dots" aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, index) => (
          <span key={index} className="tl-dot" data-active={index === stepIndex} />
        ))}
      </div>
      <div className="tl-actions">
        {isFirst ? (
          <button type="button" className="tl-button tl-button--ghost" onClick={skip}>
            Skip
          </button>
        ) : (
          <button type="button" className="tl-button tl-button--ghost" onClick={prev}>
            Back
          </button>
        )}
        <button type="button" className="tl-button tl-button--primary" onClick={next}>
          {isLast ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
};
