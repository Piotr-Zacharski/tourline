import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTourline } from "../react/hooks";
import { Popover } from "./Popover";
import { Spotlight } from "./Spotlight";
import type { StepRenderer } from "./types";
import { useTargetRect } from "./useTargetRect";

interface TourOverlayProps {
  renderStep?: StepRenderer;
}

const useKeyboard = (enabled: boolean, next: () => void, prev: () => void, skip: () => void) => {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, next, prev, skip]);
};

export const TourOverlay = ({ renderStep }: TourOverlayProps) => {
  const { active, next, prev, skip } = useTourline();
  const [mounted, setMounted] = useState(false);
  const stepKey = active === null ? "" : `${active.tourId}:${active.step.id}`;
  const targetRect = useTargetRect(active === null ? undefined : active.step.target, stepKey);

  useEffect(() => setMounted(true), []);
  useKeyboard(active !== null, next, prev, skip);

  if (!mounted || active === null) return null;

  const props = { active, targetRect, next, prev, skip };
  return createPortal(
    <div className="tl-root" data-tour={active.tourId}>
      <Spotlight rect={targetRect} onBackdropClick={skip} />
      {renderStep === undefined ? <Popover key={stepKey} {...props} /> : renderStep(props)}
    </div>,
    document.body,
  );
};
