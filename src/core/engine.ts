import type { EngineState, ProgressMap, TourDefinition, TourEvent, TourEventType, TourProgress, TourStep } from "./types";

export type EngineAction =
  /** `auto`: start only if no tour is running and this one was never started (auto-start, decided against the live state). */
  | { type: "start"; tourId: string; fromStep?: number; auto?: boolean }
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

/** Decides whether a step is shown. Hidden steps are skipped by every move; the default shows all of them. */
export type StepFilter = (step: TourStep) => boolean;

const showAll: StepFilter = () => true;

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

/** First shown step from `from` in `direction`, or -1 when there is none. */
const findShown = (tour: TourDefinition, from: number, direction: 1 | -1, isShown: StepFilter): number => {
  for (let index = from; index >= 0 && index < tour.steps.length; index += direction) {
    const step = tour.steps[index];
    if (step !== undefined && isShown(step)) return index;
  }
  return -1;
};

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

const moveTo = (
  state: EngineState,
  registry: TourRegistry,
  targetIndex: number,
  direction: 1 | -1,
  now: number,
  isShown: StepFilter,
): TransitionResult => {
  const active = getActive(state, registry);
  if (active === null) return { state, events: [] };
  const total = active.tour.steps.length;
  if (targetIndex >= total) return finish(state, registry, "completed", now);
  const stepIndex = findShown(active.tour, clampIndex(targetIndex, total), direction, isShown);
  // Nothing shown ahead means the tour is over; nothing shown behind means stay put.
  if (stepIndex === -1) return direction === 1 ? finish(state, registry, "completed", now) : { state, events: [] };
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
  isShown: StepFilter,
): TransitionResult => {
  const tour = registry.get(tourId);
  if (tour === undefined) {
    throw new Error(`[tourline] Unknown tour "${tourId}".`);
  }
  const stepIndex = findShown(tour, clampIndex(fromStep, tour.steps.length), 1, isShown);
  // Every remaining step is hidden for this user: there is nothing to show, so the tour does not start.
  if (stepIndex === -1) return { state, events: [] };
  const closed = finish(state, registry, "skipped", now);
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
  isShown: StepFilter = showAll,
): TransitionResult => {
  switch (action.type) {
    case "start":
      if (action.auto === true && (state.activeTourId !== null || state.progress[action.tourId] !== undefined)) {
        return { state, events: [] };
      }
      return start(state, registry, action.tourId, action.fromStep === undefined ? 0 : action.fromStep, now, isShown);
    case "next": {
      const active = getActive(state, registry);
      return active === null
        ? { state, events: [] }
        : moveTo(state, registry, active.progress.stepIndex + 1, 1, now, isShown);
    }
    case "prev": {
      const active = getActive(state, registry);
      return active === null
        ? { state, events: [] }
        : moveTo(state, registry, active.progress.stepIndex - 1, -1, now, isShown);
    }
    case "goTo": {
      const active = getActive(state, registry);
      const direction = active !== null && action.stepIndex < active.progress.stepIndex ? -1 : 1;
      return moveTo(state, registry, action.stepIndex, direction, now, isShown);
    }
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
      // A tour left "active" in storage resumes where the user left it, or at the next step still shown to them.
      const resumable = Object.values(action.progress).find(
        (item) => item.status === "active" && registry.has(item.tourId),
      );
      const tour = resumable === undefined ? undefined : registry.get(resumable.tourId);
      if (resumable === undefined || tour === undefined) {
        return { state: { activeTourId: null, progress: action.progress }, events: [] };
      }
      const stepIndex = findShown(tour, clampIndex(resumable.stepIndex, tour.steps.length), 1, isShown);
      if (stepIndex === -1) return { state: { activeTourId: null, progress: action.progress }, events: [] };
      const progress = stepIndex === resumable.stepIndex ? action.progress : { ...action.progress, [tour.id]: { ...resumable, stepIndex } };
      return { state: { activeTourId: tour.id, progress }, events: [] };
    }
  }
};
