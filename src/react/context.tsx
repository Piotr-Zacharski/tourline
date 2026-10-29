import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createRegistry, initialEngineState, transition } from "../core/engine";
import type { EngineAction, TourRegistry } from "../core/engine";
import { createLocalStorageAdapter } from "../core/storage";
import type { StorageAdapter } from "../core/storage";
import type { Transport } from "../core/transport";
import type { ContentOverrides, EngineState, TourDefinition, TourEvent, TourStep } from "../core/types";
import { TourOverlay } from "../ui/TourOverlay";
import type { StepRenderer } from "../ui/types";

export interface TourlineContextValue {
  state: EngineState;
  registry: TourRegistry;
  dispatch: (action: EngineAction) => void;
  resolveStep: (tourId: string, stepIndex: number) => TourStep | null;
}

const TourlineContext = createContext<TourlineContextValue | null>(null);

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

export const TourlineProvider = ({
  tours,
  children,
  storage,
  transport,
  onEvent,
  contentOverrides,
  userId,
  renderStep,
}: TourlineProviderProps) => {
  const registry = useMemo(() => createRegistry(tours), [tours]);
  const adapter = useMemo(() => (storage === undefined ? createLocalStorageAdapter() : storage), [storage]);
  const [state, setState] = useState<EngineState>(initialEngineState);
  const stateRef = useRef(state);
  const listeners = useRef({ onEvent, transport, userId });
  listeners.current = { onEvent, transport, userId };

  const dispatch = useCallback(
    (action: EngineAction) => {
      const result = transition(stateRef.current, action, registry);
      if (result.state === stateRef.current) return;
      stateRef.current = result.state;
      setState(result.state);
      if (action.type !== "hydrate") adapter.save(result.state.progress);
      const { onEvent: emit, transport: sink, userId: currentUser } = listeners.current;
      for (const event of result.events) {
        const enriched = currentUser === undefined ? event : { ...event, userId: currentUser };
        if (emit !== undefined) emit(enriched);
        if (sink !== undefined) sink.send(enriched);
      }
    },
    [registry, adapter],
  );

  // Hydrate after mount so server and client render the same markup.
  useEffect(() => {
    dispatch({ type: "hydrate", progress: adapter.load() });
  }, [adapter, dispatch]);

  const resolveStep = useCallback(
    (tourId: string, stepIndex: number) => {
      const tour = registry.get(tourId);
      const step = tour === undefined ? undefined : tour.steps[stepIndex];
      return step === undefined ? null : applyOverride(step, tourId, contentOverrides);
    },
    [registry, contentOverrides],
  );

  const value = useMemo(() => ({ state, registry, dispatch, resolveStep }), [state, registry, dispatch, resolveStep]);

  return (
    <TourlineContext.Provider value={value}>
      {children}
      <TourOverlay renderStep={renderStep} />
    </TourlineContext.Provider>
  );
};

export const useTourlineContext = (): TourlineContextValue => {
  const context = useContext(TourlineContext);
  if (context === null) {
    throw new Error("[tourline] Hooks must be used inside <TourlineProvider>.");
  }
  return context;
};
