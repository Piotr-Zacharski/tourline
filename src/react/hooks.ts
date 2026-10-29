import { useMemo } from "react";
import type { TourStatus, TourStep } from "../core/types";
import { useTourlineContext } from "./context";

export interface TourControls {
  status: TourStatus;
  stepIndex: number;
  totalSteps: number;
  isActive: boolean;
  isDone: boolean;
  start: (fromStep?: number) => void;
  reset: () => void;
}

/** Controls for a single tour — use it for "Take the tour" buttons. */
export const useTour = (tourId: string): TourControls => {
  const { state, registry, dispatch } = useTourlineContext();
  const tour = registry.get(tourId);
  if (tour === undefined) {
    throw new Error(`[tourline] useTour: unknown tour "${tourId}".`);
  }
  const progress = state.progress[tourId];
  const status: TourStatus = progress === undefined ? "idle" : progress.status;

  return useMemo(
    () => ({
      status,
      stepIndex: progress === undefined ? 0 : progress.stepIndex,
      totalSteps: tour.steps.length,
      isActive: state.activeTourId === tourId,
      isDone: status === "completed" || status === "skipped",
      start: (fromStep?: number) => dispatch({ type: "start", tourId, fromStep }),
      reset: () => dispatch({ type: "reset", tourId }),
    }),
    [status, progress, tour, state.activeTourId, tourId, dispatch],
  );
};

export interface ActiveTour {
  tourId: string;
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
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
  const { state, registry, dispatch, resolveStep } = useTourlineContext();

  const active = useMemo((): ActiveTour | null => {
    if (state.activeTourId === null) return null;
    const tour = registry.get(state.activeTourId);
    const progress = state.progress[state.activeTourId];
    if (tour === undefined || progress === undefined) return null;
    const step = resolveStep(tour.id, progress.stepIndex);
    if (step === null) return null;
    const totalSteps = tour.steps.length;
    return {
      tourId: tour.id,
      step,
      stepIndex: progress.stepIndex,
      totalSteps,
      isFirst: progress.stepIndex === 0,
      isLast: progress.stepIndex === totalSteps - 1,
    };
  }, [state, registry, resolveStep]);

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
