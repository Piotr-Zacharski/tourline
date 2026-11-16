import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createRegistry, initialEngineState, transition } from "../core/engine";
import type { EngineAction, StepFilter, TourRegistry } from "../core/engine";
import { createLocalStorageAdapter } from "../core/storage";
import type { StorageAdapter } from "../core/storage";
import type { Transport } from "../core/transport";
import type { ContentOverrides, EngineState, TourDefinition, TourEvent, TourStep, TourlineContext } from "../core/types";
import { isAnchorVisible, isOnRoute } from "./anchor";
import { TourOverlay } from "../ui/TourOverlay";
import type { StepRenderer, TourlineUIOptions } from "../ui/types";

export interface TourlineContextValue {
  state: EngineState;
  registry: TourRegistry;
  dispatch: (action: EngineAction) => void;
  resolveStep: (tourId: string, stepIndex: number) => TourStep | null;
  isShown: StepFilter;
  /** False until stored progress is loaded. Starting a tour before that would overwrite it. */
  isReady: boolean;
  /** The provider's `context`, read at call time so steps always see the latest value. */
  getContext: () => TourlineContext;
  navigate?: (route: string) => void;
  isOnRoute: (route: string) => boolean;
}

const ReactTourlineContext = createContext<TourlineContextValue | null>(null);

export interface TourlineProviderProps {
  tours: readonly TourDefinition[];
  children: ReactNode;
  /** Where progress is persisted. Defaults to localStorage. */
  storage?: StorageAdapter;
  /** Sends events to the Tourline dashboard or your own backend. */
  transport?: Transport;
  /** Called for every event; wire it to PostHog, GA, Mixpanel… */
  onEvent?: (event: TourEvent) => void;
  /** Remote copy that overrides step title/content without a deploy. */
  contentOverrides?: ContentOverrides;
  userId?: string;
  /** Replace the default popover with your own UI (headless mode). */
  renderStep?: StepRenderer;
  /** Labels, keyboard, backdrop and layout defaults for the built-in step UI. */
  ui?: TourlineUIOptions;
  /** Passed to each step's `when`, `onEnter` and `onLeave`. Extend `TourlineContext` to type it. */
  context?: TourlineContext;
  /** Client-side navigation for steps with a `route`, e.g. Next.js `router.push` or react-router `navigate`. */
  navigate?: (route: string) => void;
  /** Override route matching for dynamic routes, locale prefixes or a base path. */
  isOnRoute?: (route: string) => boolean;
}

const applyOverride = (step: TourStep, tourId: string, overrides: ContentOverrides | undefined): TourStep => {
  if (overrides === undefined) return step;
  const forTour = overrides[tourId];
  const override = forTour === undefined ? undefined : forTour[step.id];
  if (override === undefined) return step;
  return {
    ...step,
    title: override.title === undefined ? step.title : override.title,
    content: override.content === undefined ? step.content : override.content,
  };
};

// An optional step needs its target on screen. Off its route, or without a DOM (SSR), it cannot be checked yet.
const hasVisibleTarget = (step: TourStep, matchesRoute: (route: string) => boolean) => {
  if (step.optional !== true || step.target === undefined || typeof document === "undefined") return true;
  if (step.route !== undefined && !matchesRoute(step.route)) return true;
  return isAnchorVisible(step.target);
};

export const TourlineProvider = ({
  tours,
  children,
  storage,
  transport,
  onEvent,
  contentOverrides,
  userId,
  renderStep,
  ui,
  context,
  navigate,
  isOnRoute: matchesRoute = isOnRoute,
}: TourlineProviderProps) => {
  const registry = useMemo(() => createRegistry(tours), [tours]);
  const adapter = useMemo(
    () => (storage === undefined ? createLocalStorageAdapter(userId === undefined ? undefined : `tourline:progress:${userId}`) : storage),
    [storage, userId],
  );
  const [state, setState] = useState<EngineState>(initialEngineState);
  const [isReady, setIsReady] = useState(false);
  const stateRef = useRef(state);
  const hydratedAdapter = useRef<StorageAdapter | null>(null);
  const listeners = useRef({ onEvent, transport, userId });
  listeners.current = { onEvent, transport, userId };
  // Steps with `when` but no `context` on the provider get an empty object, the default shape of TourlineContext.
  const contextRef = useRef<TourlineContext>(context === undefined ? {} : context);
  contextRef.current = context === undefined ? {} : context;
  const getContext = useCallback(() => contextRef.current, []);
  const isShown = useCallback<StepFilter>(
    (step) => (step.when === undefined || step.when(contextRef.current)) && hasVisibleTarget(step, matchesRoute),
    [matchesRoute],
  );
  const isEligible = useCallback<StepFilter>((step) => step.when === undefined || step.when(contextRef.current), []);

  const dispatch = useCallback(
    (action: EngineAction) => {
      const previous = stateRef.current;
      const result = transition(previous, action, registry, Date.now(), action.type === "start" && action.auto === true ? isEligible : isShown);
      if (result.state === previous && result.events.length === 0) return;
      if (result.state !== previous) {
        stateRef.current = result.state;
        setState(result.state);
        if (action.type !== "hydrate") adapter.save(result.state.progress);
      }
      const { onEvent: emit, transport: sink, userId: currentUser } = listeners.current;
      for (const event of result.events) {
        const enriched = currentUser === undefined ? event : { ...event, userId: currentUser };
        if (emit !== undefined) emit(enriched);
        if (sink !== undefined) sink.send(enriched);
      }
    },
    [registry, adapter, isShown, isEligible],
  );

  // Hydrate after mount so server and client render the same markup. Both updates land in one render,
  // so nothing sees isReady before the stored progress.
  useEffect(() => {
    if (hydratedAdapter.current === adapter) return;
    hydratedAdapter.current = adapter;
    dispatch({ type: "hydrate", progress: adapter.load() });
    setIsReady(true);
  }, [adapter, dispatch]);

  const resolveStep = useCallback(
    (tourId: string, stepIndex: number) => {
      const tour = registry.get(tourId);
      const step = tour === undefined ? undefined : tour.steps[stepIndex];
      return step === undefined ? null : applyOverride(step, tourId, contentOverrides);
    },
    [registry, contentOverrides],
  );

  const value = useMemo(
    () => ({ state, registry, dispatch, resolveStep, isShown, isReady, getContext, navigate, isOnRoute: matchesRoute }),
    [state, registry, dispatch, resolveStep, isShown, isReady, getContext, navigate, matchesRoute],
  );

  return (
    <ReactTourlineContext.Provider value={value}>
      {children}
      <TourOverlay renderStep={renderStep} ui={ui} />
    </ReactTourlineContext.Provider>
  );
};

export const useTourlineContext = (): TourlineContextValue => {
  const context = useContext(ReactTourlineContext);
  if (context === null) {
    throw new Error("[tourline] Hooks must be used inside <TourlineProvider>.");
  }
  return context;
};
