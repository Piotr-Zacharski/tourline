import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  (target.isContentEditable ||
    target.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [role="tab"], [role="listbox"], [role="combobox"], [role="option"]') !== null);

const useKeyboard = ({ enabled, allowBack, allowSkip }: KeyboardOptions, next: () => void, prev: () => void, skip: () => void) => {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      // Arrow keys move the caret in an interactive step's input; leave them to it.
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (isEditable(event.target) && event.key !== "Escape") return;
      if (event.key === "Escape" && allowSkip) skip();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft" && allowBack) prev();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, allowBack, allowSkip, next, prev, skip]);
};

/**
 * Moves to the next step when `eventName` fires on the target. Delegated, so a target that renders late still counts.
 * The move waits for the app to handle the event first: a click that opens a menu has rendered it by then,
 * so the next step can find (or, if `optional`, check) its target.
 */
const useAdvanceOn = (target: string | undefined, eventName: string | undefined, next: () => void) => {
  useEffect(() => {
    if (target === undefined || eventName === undefined) return undefined;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const onEvent = (event: Event) => {
      const element = findAnchor(target);
      if (element !== null && event.target instanceof Node && element.contains(event.target)) {
        clearTimeout(pending);
        pending = setTimeout(next, 0);
      }
    };
    document.addEventListener(eventName, onEvent, true);
    return () => {
      document.removeEventListener(eventName, onEvent, true);
      clearTimeout(pending);
    };
  }, [target, eventName, next]);
};

export const TourOverlay = ({ renderStep, ui: uiOptions }: TourOverlayProps) => {
  const { active, next, prev, skip } = useTourline();
  const { dispatch, getContext, navigate, isOnRoute } = useTourlineContext();
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const isOnRouteRef = useRef(isOnRoute);
  isOnRouteRef.current = isOnRoute;
  const ui = useMemo(() => resolveUIOptions(uiOptions), [uiOptions]);
  const step = active === null ? null : active.step;
  const stepKey = active === null ? "" : `${active.tourId}:${active.step.id}`;
  const reportMissing = useCallback(() => {
    dispatch({ type: "targetMissing" });
    if (step?.optional === true) dispatch({ type: "next" });
  }, [dispatch, step?.optional]);
  const { rect, rectKey, pending } = useTargetRect(step === null ? undefined : step.target, stepKey, ui.targetTimeout, reportMissing);
  // The spotlight glides from the previous rect; the popover waits for the new one instead of centering first.
  const targetRect = pending ? null : rect;
  const allowBack = step === null || step.allowBack !== false;
  const allowSkip = step === null || step.allowSkip !== false;
  const interactive = step !== null && (step.interactive === true || step.advanceOn !== undefined);

  useEffect(() => {
    if (active === null) {
      previousFocus.current?.focus({ preventScroll: true });
      previousFocus.current = null;
      return undefined;
    }
    if (previousFocus.current === null && document.activeElement instanceof HTMLElement) previousFocus.current = document.activeElement;
    if (interactive) return undefined;
    const root = rootRef.current;
    if (root === null) return undefined;
    const siblings = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== root);
    const previous = siblings.map((element) => element.inert);
    siblings.forEach((element) => { element.inert = true; });
    return () => siblings.forEach((element, index) => { element.inert = previous[index] ?? false; });
  }, [active === null, stepKey, interactive]);

  // Read through refs so this fires once per step, not on every re-render that rebuilds the step object.
  const stepRef = useRef(step);
  stepRef.current = step;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    const entered = stepRef.current;
    if (entered === null) return undefined;
    // Go to the step's page first; useTargetRect then waits for the target to render there.
    if (entered.route !== undefined && !isOnRouteRef.current(entered.route)) {
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
    <div ref={rootRef} className="tl-root" data-tour={active.tourId}>
      <Spotlight
        rect={rect}
        rectKey={rectKey}
        padding={step.padding === undefined ? ui.padding : step.padding}
        interactive={interactive}
        onBackdropClick={ui.closeOnBackdropClick && allowSkip ? skip : undefined}
      />
      {renderStep === undefined ? <Popover key={stepKey} pending={pending} {...props} /> : renderStep(props)}
    </div>,
    document.body,
  );
};
