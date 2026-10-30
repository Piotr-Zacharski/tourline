import { useEffect, useMemo } from "react";
import type { EngineAction } from "../core/engine";
import type { TourDefinition, TourProgress, TourStatus, TourStep } from "../core/types";
import { useTourlineContext } from "./context";

export interface TourControls {
  tourId: string;
  status: TourStatus;
  /** Step the user is on, or left the tour on: skipped and completed tours keep it. */
  stepIndex: number;
  totalSteps: number;
  isActive: boolean;
  isCompleted: boolean;
  isSkipped: boolean;
  /** Completed or skipped. */
  isDone: boolean;
  /** False until stored progress is loaded: before that `status` reads "idle", even for a finished tour. */
  isReady: boolean;
  start: (fromStep?: number) => void;
  /** Continue a skipped tour from the step it was left on; start any other from the beginning. */
  resume: () => void;
  reset: () => void;
}

const makeControls = (
  tour: TourDefinition,
  progress: TourProgress | undefined,
  activeTourId: string | null,
  isReady: boolean,
  dispatch: (action: EngineAction) => void,
): TourControls => {
  const status: TourStatus = progress === undefined ? "idle" : progress.status;
  const stepIndex = progress === undefined ? 0 : progress.stepIndex;
  const isActive = activeTourId === tour.id;
  return {
    tourId: tour.id,
    status,
    stepIndex,
    totalSteps: tour.steps.length,
    isActive,
    isCompleted: status === "completed",
    isSkipped: status === "skipped",
    isDone: status === "completed" || status === "skipped",
    isReady,
    start: (fromStep?: number) => dispatch({ type: "start", tourId: tour.id, fromStep }),
    resume: () => {
      // Starting the running tour again would first end it as skipped; it already is where it should be.
      if (isActive) return;
      dispatch({ type: "start", tourId: tour.id, fromStep: status === "skipped" ? stepIndex : 0 });
    },
    reset: () => dispatch({ type: "reset", tourId: tour.id }),
  };
};

/** Controls for a single tour — use it for "Take the tour" buttons. */
export const useTour = (tourId: string): TourControls => {
  const { state, registry, dispatch, isReady } = useTourlineContext();
  const tour = registry.get(tourId);
  if (tour === undefined) {
    throw new Error(`[tourline] useTour: unknown tour "${tourId}".`);
  }
  const progress = state.progress[tourId];

  return useMemo(
    () => makeControls(tour, progress, state.activeTourId, isReady, dispatch),
    [tour, progress, state.activeTourId, isReady, dispatch],
  );
};

export interface TourlineProgress {
  /** One entry per tour, in the order asked for (by default, the order of the provider's `tours`). */
  tours: TourControls[];
  completed: number;
  total: number;
  isReady: boolean;
}

/** Progress across several tours at once, e.g. for a "3 of 8 done" ring or a custom checklist. */
export const useTourlineProgress = (tourIds?: readonly string[]): TourlineProgress => {
  const { state, registry, dispatch, isReady } = useTourlineContext();
  // Callers usually pass a fresh array each render; memoize on its contents instead.
  const idsKey = tourIds === undefined ? null : JSON.stringify(tourIds);

  return useMemo(() => {
    const ids: string[] = idsKey === null ? [...registry.keys()] : JSON.parse(idsKey);
    const tours = ids.map((tourId) => {
      const tour = registry.get(tourId);
      if (tour === undefined) {
        throw new Error(`[tourline] useTourlineProgress: unknown tour "${tourId}".`);
      }
      return makeControls(tour, state.progress[tourId], state.activeTourId, isReady, dispatch);
    });
    return { tours, completed: tours.filter((tour) => tour.isCompleted).length, total: tours.length, isReady };
  }, [idsKey, registry, state, isReady, dispatch]);
};

export interface AutoStartOptions {
  /** Hold the auto-start, e.g. while the page decides which tour to show. Default `true`. */
  enabled?: boolean;
}

/**
 * Starts a tour the first time the calling component renders: only once stored progress is loaded,
 * only if the tour was never started, and never over another running tour (it waits for that one to end).
 */
export const useAutoStartTour = (tourId: string, { enabled = true }: AutoStartOptions = {}): void => {
  const { state, dispatch, isReady } = useTourlineContext();
  const isIdle = state.progress[tourId] === undefined;
  const isAnyTourRunning = state.activeTourId !== null;

  // Re-checked when the running tour ends. The engine decides against the live state, so two
  // auto-starts in the same render cannot cancel each other.
  useEffect(() => {
    if (enabled && isReady && isIdle && !isAnyTourRunning) dispatch({ type: "start", tourId, auto: true });
  }, [enabled, isReady, isIdle, isAnyTourRunning, tourId, dispatch]);
};

export interface ActiveTour {
  tourId: string;
  step: TourStep;
  /** Index in the tour definition, as in analytics events. */
  stepIndex: number;
  totalSteps: number;
  /** 0-based position among the steps shown to this user (steps hidden by `when` do not count). */
  shownIndex: number;
  /** Number of steps shown to this user. */
  shownTotal: number;
  /** First and last among the shown steps. */
  isFirst: boolean;
  isLast: boolean;
}

export interface TourlineControls {
  active: ActiveTour | null;
  next: () => void;
  prev: () => void;
  goTo: (stepIndex: number) => void;
  skip: () => void;
  complete: () => void;
}

/** The currently running tour plus navigation — what custom step UIs need. */
export const useTourline = (): TourlineControls => {
  const { state, registry, dispatch, resolveStep, isShown } = useTourlineContext();

  const active = useMemo((): ActiveTour | null => {
    if (state.activeTourId === null) return null;
    const tour = registry.get(state.activeTourId);
    const progress = state.progress[state.activeTourId];
    if (tour === undefined || progress === undefined) return null;
    const step = resolveStep(tour.id, progress.stepIndex);
    if (step === null) return null;
    const shown = tour.steps.flatMap((candidate, index) => (isShown(candidate) ? [index] : []));
    const shownIndex = shown.indexOf(progress.stepIndex);
    return {
      tourId: tour.id,
      step,
      stepIndex: progress.stepIndex,
      totalSteps: tour.steps.length,
      shownIndex,
      shownTotal: shown.length,
      isFirst: shownIndex === 0,
      isLast: shownIndex === shown.length - 1,
    };
  }, [state, registry, resolveStep, isShown]);

  return useMemo(
    () => ({
      active,
      next: () => dispatch({ type: "next" }),
      prev: () => dispatch({ type: "prev" }),
      goTo: (stepIndex: number) => dispatch({ type: "goTo", stepIndex }),
      skip: () => dispatch({ type: "skip" }),
      complete: () => dispatch({ type: "complete" }),
    }),
    [active, dispatch],
  );
};
