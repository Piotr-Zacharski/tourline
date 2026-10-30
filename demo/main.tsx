import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Checklist, TourlineProvider, createLocalStorageAdapter, useTourline } from "../src";
import type { TourEvent, TourlineUIOptions } from "../src";
import { MockApp } from "./MockApp";
import { VIEW_EVENT, onboarding, polishCopy } from "./tours";

const storage = createLocalStorageAdapter("tourline-demo:progress");

const CHECKLIST = [
  { tourId: "welcome", label: "Take the welcome tour", description: "10 steps around the app, ends on New invoice" },
  { tourId: "invoices", label: "Learn the invoice list", description: "4 steps, a clickable row, ends when you type" },
  { tourId: "reports", label: "Open a report", description: "5 steps, waits for a lazy chart, no skip at the end" },
  { tourId: "options", label: "See every option", description: "12 steps, one setting per step" },
] as const;

const EVENT_LABEL: Record<TourEvent["type"], string> = {
  tour_started: "started",
  step_viewed: "viewed",
  tour_completed: "completed",
  tour_skipped: "skipped",
};

type View = "invoices" | "reports";

const POLISH_LABELS: TourlineUIOptions["labels"] = {
  next: "Dalej",
  back: "Wstecz",
  skip: "Pomiń",
  done: "Gotowe",
  close: "Zamknij przewodnik",
  progress: (current, total) => `Krok ${current} z ${total}`,
};

type Toggle = "showProgress" | "showDots" | "keyboard" | "closeOnBackdropClick";

const TOGGLES: readonly { key: Toggle; label: string }[] = [
  { key: "showProgress", label: "Step counter" },
  { key: "showDots", label: "Progress dots" },
  { key: "keyboard", label: "Keyboard: Esc, ← and →" },
  { key: "closeOnBackdropClick", label: "Click the backdrop to skip" },
];

interface OptionsState extends Record<Toggle, boolean> {
  padding: number;
  gap: number;
}

const DEFAULT_OPTIONS: OptionsState = {
  showProgress: true,
  showDots: true,
  keyboard: true,
  closeOnBackdropClick: true,
  padding: 6,
  gap: 12,
};

const OptionsPanel = ({ options, onChange }: { options: OptionsState; onChange: (options: OptionsState) => void }) => (
  <section className="panel" aria-labelledby="options-heading">
    <h2 id="options-heading" className="panel__title">
      Tour options
      <span className="panel__hint">the ui prop, applied live</span>
    </h2>
    {TOGGLES.map(({ key, label }) => (
      <label key={key} className="switch" htmlFor={`option-${key}`}>
        <input
          id={`option-${key}`}
          type="checkbox"
          checked={options[key]}
          onChange={(e) => onChange({ ...options, [key]: e.target.checked })}
        />
        <span>{label}</span>
      </label>
    ))}
    <label className="range" htmlFor="option-padding">
      <span>
        Spotlight padding <output>{options.padding}px</output>
      </span>
      <input
        id="option-padding"
        type="range"
        min={0}
        max={20}
        value={options.padding}
        onChange={(e) => onChange({ ...options, padding: Number(e.target.value) })}
      />
    </label>
    <label className="range" htmlFor="option-gap">
      <span>
        Popover gap <output>{options.gap}px</output>
      </span>
      <input
        id="option-gap"
        type="range"
        min={0}
        max={32}
        value={options.gap}
        onChange={(e) => onChange({ ...options, gap: Number(e.target.value) })}
      />
    </label>
  </section>
);

/** Keeps the mock app on the right view: reports for the reports tour past step 1, or whatever a step asks for via VIEW_EVENT. */
const ViewSync = ({ setView }: { setView: (view: View) => void }) => {
  const { active } = useTourline();
  const key = active === null ? "" : `${active.tourId}/${active.step.id}`;
  useEffect(() => {
    if (key.startsWith("reports/") && key !== "reports/open") setView("reports");
    if (key.startsWith("invoices/") || key.startsWith("welcome/")) setView("invoices");
  }, [key, setView]);
  useEffect(() => {
    const onView = (event: Event) => {
      if (event instanceof CustomEvent && (event.detail === "invoices" || event.detail === "reports")) setView(event.detail);
    };
    window.addEventListener(VIEW_EVENT, onView);
    return () => window.removeEventListener(VIEW_EVENT, onView);
  }, [setView]);
  return null;
};

const EventLog = ({ events }: { events: readonly TourEvent[] }) => (
  <section className="panel" aria-labelledby="events-heading">
    <h2 id="events-heading" className="panel__title">
      Events
      <span className="panel__hint">what the dashboard receives</span>
    </h2>
    {events.length === 0 ? (
      <p className="log__empty">Start a tour. Every step shows up here, ready for a drop-off funnel.</p>
    ) : (
      <ol className="log" aria-live="polite">
        {events.map((event, index) => (
          <li key={`${event.timestamp}-${index}`} className="log__row" data-type={event.type}>
            <span className="log__type">{EVENT_LABEL[event.type]}</span>
            <span className="log__id">
              {event.tourId}/{event.stepId}
            </span>
            <span className="log__step">
              {event.stepIndex + 1}/{event.totalSteps}
            </span>
          </li>
        ))}
      </ol>
    )}
  </section>
);

const resetAll = () => {
  try {
    window.localStorage.removeItem("tourline-demo:progress");
  } catch {
    // Storage unavailable: a reload starts fresh anyway.
  }
  window.location.reload();
};

const Demo = () => {
  const [events, setEvents] = useState<TourEvent[]>([]);
  const [polish, setPolish] = useState(false);
  const [view, setView] = useState<View>("invoices");
  const [options, setOptions] = useState<OptionsState>(DEFAULT_OPTIONS);
  const ui = useMemo(
    (): TourlineUIOptions => ({ ...options, labels: polish ? POLISH_LABELS : undefined }),
    [options, polish],
  );
  const onEvent = useCallback((event: TourEvent) => setEvents((list) => [event, ...list].slice(0, 30)), []);

  return (
    <TourlineProvider
      tours={onboarding.tours}
      storage={storage}
      onEvent={onEvent}
      contentOverrides={polish ? polishCopy : undefined}
      ui={ui}
      userId="demo-user"
    >
      <ViewSync setView={setView} />
      <div className="layout">
        <div className="stage">
          <MockApp view={view} onViewChange={setView} />
        </div>
        <div className="side">
          <Checklist title="Get started with Harbor" items={CHECKLIST} />
          <section className="panel" aria-labelledby="copy-heading">
            <h2 id="copy-heading" className="panel__title">
              Remote copy
              <span className="panel__hint">edited in the dashboard, no deploy</span>
            </h2>
            <label className="switch" htmlFor="copy-switch">
              <input id="copy-switch" type="checkbox" checked={polish} onChange={(e) => setPolish(e.target.checked)} />
              <span>Serve the Polish version of the welcome tour and buttons</span>
            </label>
          </section>
          <OptionsPanel options={options} onChange={setOptions} />
          <EventLog events={events} />
          <button type="button" className="reset" onClick={resetAll}>
            Reset progress
          </button>
        </div>
      </div>
    </TourlineProvider>
  );
};

const container = document.getElementById("demo");
if (container !== null) {
  createRoot(container).render(
    <StrictMode>
      <Demo />
    </StrictMode>,
  );
}
