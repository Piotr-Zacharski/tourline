import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findAnchor } from "../react/anchor";
import { useTourlineContext } from "../react/context";
import { useTourline } from "../react/hooks";
import { Popover } from "./Popover";
import { Spotlight } from "./Spotlight";
import { resolveUIOptions } from "./types";
import type { StepRenderer, TourlineUIOptions } from "./types";
import { useTargetRect } from "./useTargetRect";

interface TourOverlayProps {
  renderStep?: StepRenderer;
  ui?: TourlineUIOptions;
}

interface KeyboardOptions {
  enabled: boolean;
  allowBack: boolean;
  allowSkip: boolean;
}

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

const useKeyboard = ({ enabled, allowBack, allowSkip }: KeyboardOptions, next: () => void, prev: () => void, skip: () => void) => {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      // Arrow keys move the caret in an interactive step's input; leave them to it.
      if (isEditable(event.target) && event.key !== "Escape") return;
      if (event.key === "Escape" && allowSkip) skip();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft" && allowBack) prev();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, allowBack, allowSkip, next, prev, skip]);
};

/** Moves to the next step when `eventName` fires on the target. Delegated, so a target that renders late still counts. */
const useAdvanceOn = (target: string | undefined, eventName: string | undefined, next: () => void) => {
  useEffect(() => {
    if (target === undefined || eventName === undefined) return undefined;
    const onEvent = (event: Event) => {
      const element = findAnchor(target);
      if (element !== null && event.target instanceof Node && element.contains(event.target)) next();
    };
    document.addEventListener(eventName, onEvent, true);
    return () => document.removeEventListener(eventName, onEvent, true);
  }, [target, eventName, next]);
};

const isOnRoute = (route: string) => {
  const { pathname, search } = window.location;
  return route === pathname || route === pathname + search;
};

export const TourOverlay = ({ renderStep, ui: uiOptions }: TourOverlayProps) => {
  const { active, next, prev, skip } = useTourline();
  const { getContext, navigate } = useTourlineContext();
  const [mounted, setMounted] = useState(false);
  const ui = useMemo(() => resolveUIOptions(uiOptions), [uiOptions]);
  const step = active === null ? null : active.step;
  const stepKey = active === null ? "" : `${active.tourId}:${active.step.id}`;
  const { rect, rectKey, pending } = useTargetRect(step === null ? undefined : step.target, stepKey, ui.targetTimeout);
  // The spotlight glides from the previous rect; the popover waits for the new one instead of centering first.
  const targetRect = pending ? null : rect;
  const allowBack = step === null || step.allowBack !== false;
  const allowSkip = step === null || step.allowSkip !== false;

  // Read through refs so this fires once per step, not on every re-render that rebuilds the step object.
  const stepRef = useRef(step);
  stepRef.current = step;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    const entered = stepRef.current;
    if (entered === null) return undefined;
    // Go to the step's page first; useTargetRect then waits for the target to render there.
    if (entered.route !== undefined && !isOnRoute(entered.route)) {
      const go = navigateRef.current;
      if (go !== undefined) go(entered.route);
      else console.warn(`[tourline] Step "${entered.id}" has route "${entered.route}" but <TourlineProvider> has no navigate.`);
    }
    if (entered.onEnter !== undefined) entered.onEnter(getContext());
    return () => {
      if (entered.onLeave !== undefined) entered.onLeave(getContext());
    };
  }, [stepKey, getContext]);

  useEffect(() => setMounted(true), []);
  useKeyboard({ enabled: active !== null && ui.keyboard, allowBack, allowSkip }, next, prev, skip);
  useAdvanceOn(step === null ? undefined : step.target, step === null ? undefined : step.advanceOn, next);

  if (!mounted || active === null || step === null) return null;

  const props = { active, targetRect, ui, next, prev, skip };
  return createPortal(
    <div className="tl-root" data-tour={active.tourId}>
      <Spotlight
        rect={rect}
        rectKey={rectKey}
        padding={step.padding === undefined ? ui.padding : step.padding}
        interactive={step.interactive === true || step.advanceOn !== undefined}
        onBackdropClick={ui.closeOnBackdropClick && allowSkip ? skip : undefined}
      />
      {renderStep === undefined ? <Popover key={stepKey} pending={pending} {...props} /> : renderStep(props)}
    </div>,
    document.body,
  );
};
