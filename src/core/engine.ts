import type { EngineState, ProgressMap, TourDefinition, TourEvent, TourEventType, TourProgress } from "./types";

export type EngineAction =
  | { type: "start"; tourId: string; fromStep?: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "goTo"; stepIndex: number }
  | { type: "skip" }
  | { type: "complete" }
  | { type: "reset"; tourId: string }
  | { type: "hydrate"; progress: ProgressMap };

export interface TransitionResult {
  state: EngineState;
  events: TourEvent[];
}

export type TourRegistry = ReadonlyMap<string, TourDefinition>;

export const initialEngineState: EngineState = { activeTourId: null, progress: {} };

export const createRegistry = (tours: readonly TourDefinition[]): TourRegistry => {
  const registry = new Map<string, TourDefinition>();
  for (const tour of tours) {
    if (registry.has(tour.id)) {
      throw new Error(`[tourline] Duplicate tour id "${tour.id}".`);
    }
    if (tour.steps.length === 0) {
      throw new Error(`[tourline] Tour "${tour.id}" has no steps.`);
    }
    registry.set(tour.id, tour);
  }
  return registry;
};

const clampIndex = (index: number, total: number): number => Math.min(Math.max(index, 0), total - 1);

const makeEvent = (
  type: TourEventType,
  tour: TourDefinition,
  stepIndex: number,
  now: number,
): TourEvent => {
  const step = tour.steps[stepIndex];
  if (step === undefined) {
    throw new Error(`[tourline] Step ${stepIndex} does not exist in tour "${tour.id}".`);
  }
  return { type, tourId: tour.id, stepId: step.id, stepIndex, totalSteps: tour.steps.length, timestamp: now };
};

const withProgress = (state: EngineState, progress: TourProgress, activeTourId: string | null): EngineState => ({
  activeTourId,
  progress: { ...state.progress, [progress.tourId]: progress },
});

const getActive = (state: EngineState, registry: TourRegistry) => {
  if (state.activeTourId === null) return null;
  const tour = registry.get(state.activeTourId);
  const progress = state.progress[state.activeTourId];
  if (tour === undefined || progress === undefined) return null;
  return { tour, progress };
};

const finish = (
  state: EngineState,
  registry: TourRegistry,
  status: "completed" | "skipped",
  now: number,
): TransitionResult => {
  const active = getActive(state, registry);
  if (active === null) return { state, events: [] };
  const eventType = status === "completed" ? "tour_completed" : "tour_skipped";
  return {
    state: withProgress(state, { ...active.progress, status, updatedAt: now }, null),
    events: [makeEvent(eventType, active.tour, active.progress.stepIndex, now)],
  };
};

const moveTo = (state: EngineState, registry: TourRegistry, targetIndex: number, now: number): TransitionResult => {
  const active = getActive(state, registry);
  if (active === null) return { state, events: [] };
  const total = active.tour.steps.length;
  if (targetIndex >= total) return finish(state, registry, "completed", now);
  const stepIndex = clampIndex(targetIndex, total);
  if (stepIndex === active.progress.stepIndex) return { state, events: [] };
  return {
    state: withProgress(state, { ...active.progress, stepIndex, updatedAt: now }, active.tour.id),
    events: [makeEvent("step_viewed", active.tour, stepIndex, now)],
  };
};

const start = (
  state: EngineState,
  registry: TourRegistry,
  tourId: string,
  fromStep: number,
  now: number,
): TransitionResult => {
  const tour = registry.get(tourId);
  if (tour === undefined) {
    throw new Error(`[tourline] Unknown tour "${tourId}".`);
  }
  const closed = finish(state, registry, "skipped", now);
  const stepIndex = clampIndex(fromStep, tour.steps.length);
  const progress: TourProgress = { tourId, status: "active", stepIndex, updatedAt: now };
  return {
    state: withProgress(closed.state, progress, tourId),
    events: [...closed.events, makeEvent("tour_started", tour, stepIndex, now), makeEvent("step_viewed", tour, stepIndex, now)],
  };
};

/** Pure state machine. Every UI interaction goes through here, which keeps it trivially testable. */
export const transition = (
  state: EngineState,
  action: EngineAction,
  registry: TourRegistry,
  now: number = Date.now(),
): TransitionResult => {
  switch (action.type) {
    case "start":
      return start(state, registry, action.tourId, action.fromStep === undefined ? 0 : action.fromStep, now);
    case "next": {
      const active = getActive(state, registry);
      return active === null ? { state, events: [] } : moveTo(state, registry, active.progress.stepIndex + 1, now);
    }
    case "prev": {
      const active = getActive(state, registry);
      return active === null ? { state, events: [] } : moveTo(state, registry, active.progress.stepIndex - 1, now);
    }
    case "goTo":
      return moveTo(state, registry, action.stepIndex, now);
    case "skip":
      return finish(state, registry, "skipped", now);
    case "complete":
      return finish(state, registry, "completed", now);
    case "reset": {
      const { [action.tourId]: _removed, ...rest } = state.progress;
      const activeTourId = state.activeTourId === action.tourId ? null : state.activeTourId;
      return { state: { activeTourId, progress: rest }, events: [] };
    }
    case "hydrate": {
      // A tour left "active" in storage resumes where the user left it.
      const resumable = Object.values(action.progress).find(
        (item) => item.status === "active" && registry.has(item.tourId),
      );
      return {
        state: { activeTourId: resumable === undefined ? null : resumable.tourId, progress: action.progress },
        events: [],
      };
    }
  }
};
