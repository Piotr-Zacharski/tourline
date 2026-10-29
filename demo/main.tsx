import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Checklist, TourlineProvider, createLocalStorageAdapter, useTourline } from "../src";
import type { TourEvent } from "../src";
import { MockApp } from "./MockApp";
import { onboarding, polishCopy } from "./tours";

const storage = createLocalStorageAdapter("tourline-demo:progress");

const CHECKLIST = [
  { tourId: "welcome", label: "Take the welcome tour", description: "4 steps, centered intro" },
  { tourId: "invoices", label: "Learn the invoice list", description: "2 anchored steps" },
  { tourId: "reports", label: "Open a report", description: "Waits for a lazy element" },
] as const;

const EVENT_LABEL: Record<TourEvent["type"], string> = {
  tour_started: "started",
  step_viewed: "viewed",
  tour_completed: "completed",
  tour_skipped: "skipped",
};

type View = "invoices" | "reports";

/** Switches the mock app to the reports view when the reports tour advances past step 1. */
const ViewSync = ({ setView }: { setView: (view: View) => void }) => {
  const { active } = useTourline();
  const key = active === null ? "" : `${active.tourId}/${active.step.id}`;
  useEffect(() => {
    if (key === "reports/chart") setView("reports");
    if (key.startsWith("invoices/") || key.startsWith("welcome/")) setView("invoices");
  }, [key, setView]);
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
  const onEvent = useCallback((event: TourEvent) => setEvents((list) => [event, ...list].slice(0, 30)), []);

  return (
    <TourlineProvider
      tours={onboarding.tours}
      storage={storage}
      onEvent={onEvent}
      contentOverrides={polish ? polishCopy : undefined}
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
              <span>Serve the Polish version of the welcome tour</span>
            </label>
          </section>
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
